import { NextResponse, type NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/admin";
import { evaluateLiveZones, type LiveZoneEval } from "@/lib/live-board";
import { sendNotificationEmail } from "@/lib/email";
import type { Tenant } from "@/lib/types";

// Out-of-ratio alerting for the LIVE board. The on-screen badge is already
// real-time (the board refreshes itself); this cron is what turns a sustained
// deficiency into an alert to the pharmacy's own managers — in-app + a gated
// email. RxShift never contacts any board; whether to report is the pharmacy's
// call.
//
// Two guards keep it from crying wolf, both stored in live_ratio_alert_state so
// they're correct regardless of how often the cron actually runs:
//   GRACE    — a zone must be deficient for this long before the first alert,
//              so an accidental mis-click that's fixed quickly never fires.
//   COOLDOWN — an ongoing deficiency isn't re-sent more than once per window.
//
// NOTE: minute-by-minute delivery needs a per-minute cron, which requires a
// paid Vercel plan. On the free plan this effectively runs about once a day, so
// alerts are delayed until the RxShift Vercel account is on Pro. The grace /
// cooldown state means a slower cadence only delays alerts — it never makes
// them wrong or duplicated.

const GRACE_MINUTES = 5;
const COOLDOWN_MINUTES = 60;

export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();

  const { data: tenants } = await supabase
    .from("tenant")
    .select("*")
    .eq("has_ratio", true);

  let zonesDeficient = 0;
  let alertsFired = 0;

  for (const tenant of (tenants ?? []) as Tenant[]) {
    const zones = await evaluateLiveZones(tenant, supabase);

    for (const z of zones) {
      const { data: state } = await supabase
        .from("live_ratio_alert_state")
        .select("*")
        .eq("tenant_id", tenant.id)
        .eq("ratio_zone_id", z.zoneId)
        .maybeSingle();

      if (z.status !== "deficient") {
        // Recovered (or never deficient): clear tracking so a brief blip that
        // self-corrects within the grace window never alerted, and a future
        // deficiency is treated fresh.
        if (state && (state.deficient_since || state.last_alerted_at)) {
          await supabase
            .from("live_ratio_alert_state")
            .update({
              deficient_since: null,
              last_alerted_at: null,
              updated_at: nowIso,
            })
            .eq("id", state.id);
        }
        continue;
      }

      zonesDeficient += 1;

      const deficientSinceIso = state?.deficient_since ?? nowIso;
      const deficientForMin = (nowMs - Date.parse(deficientSinceIso)) / 60000;
      const lastAlerted = state?.last_alerted_at
        ? Date.parse(state.last_alerted_at)
        : null;
      const cooledDown =
        lastAlerted === null || (nowMs - lastAlerted) / 60000 >= COOLDOWN_MINUTES;
      const shouldAlert = deficientForMin >= GRACE_MINUTES && cooledDown;

      await supabase.from("live_ratio_alert_state").upsert(
        {
          tenant_id: tenant.id,
          ratio_zone_id: z.zoneId,
          deficient_since: deficientSinceIso,
          last_alerted_at: shouldAlert ? nowIso : (state?.last_alerted_at ?? null),
          updated_at: nowIso,
        },
        { onConflict: "tenant_id,ratio_zone_id" }
      );

      if (shouldAlert) {
        await fireAlert(supabase, tenant, z);
        alertsFired += 1;
      }
    }
  }

  return NextResponse.json({
    ok: true,
    tenantsChecked: tenants?.length ?? 0,
    zonesDeficient,
    alertsFired,
    timestamp: nowIso,
  });
}

async function fireAlert(
  supabase: SupabaseClient,
  tenant: Tenant,
  zone: LiveZoneEval
) {
  const { data: managers } = await supabase
    .from("app_user")
    .select("supabase_user_id, staff(work_email, login_email)")
    .eq("tenant_id", tenant.id)
    .in("role", ["owner_admin", "scheduler", "supervisor"]);

  const lines = [
    "The live ratio board is showing a deficiency right now:",
    `${zone.zoneName}: ${zone.reason ?? "out of ratio"}`,
    "Adjust coverage in RxShift to restore the ratio. Whether and how to report is your pharmacy's decision — RxShift never contacts the board.",
  ];

  for (const m of managers ?? []) {
    await supabase.from("notification").insert({
      tenant_id: tenant.id,
      user_id: m.supabase_user_id,
      type: "live_ratio_deficient",
      payload: { zone_id: zone.zoneId, zone: zone.zoneName, reason: zone.reason },
      channel: "in_app",
    });
    const staff = m.staff as
      | { work_email?: string; login_email?: string }
      | null;
    const addr = staff?.work_email ?? staff?.login_email;
    if (addr) {
      await sendNotificationEmail(
        tenant,
        addr,
        "Live ratio alert — a zone is out of ratio now",
        lines
      );
    }
  }
}
