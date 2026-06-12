// Seeds realistic live_status rows for the demo tenant so the live board
// looks like a working pharmacy floor RIGHT NOW: a believable lunch
// rotation, a meeting, someone off the floor — instead of every scheduled
// person defaulting to "counting" (which reads as static and usually
// deficient/red).
//
// Derives everything from today's REAL shifts — no dates are changed.
// Idempotent: closes any open live_status rows for the tenant first.
// Safe to re-run mid-demo; the board refreshes every 60s.
//
// Run: npx tsx scripts/seed-live-now.ts

import { readFileSync } from "fs";
import { join } from "path";
import { createClient } from "@supabase/supabase-js";
import { nowInTimeZone } from "../lib/dates";

// ── env ──────────────────────────────────────────────────────────────────────
const envText = readFileSync(join(__dirname, "..", ".env.local"), "utf8");
const env: Record<string, string> = {};
for (const line of envText.split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}
const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL!,
  env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);

const TENANT_NAME = "OptumRx Demo";

function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

async function main() {
  const { data: tenant } = await supabase
    .from("tenant")
    .select("id, name, timezone")
    .eq("name", TENANT_NAME)
    .maybeSingle();
  if (!tenant) throw new Error(`Tenant "${TENANT_NAME}" not found.`);

  const { date: today, minutes: nowMinutes } = nowInTimeZone(tenant.timezone);
  console.log(`Tenant clock (${tenant.timezone}): ${today}, minute ${nowMinutes} of day`);

  // Today's shifts with segments + staff, to find who is on the floor now
  const { data: shifts, error } = await supabase
    .from("shift")
    .select("id, staff_id, date, staff(id, full_name, ratio_type, job_title), shift_segment(start_time, end_time)")
    .eq("tenant_id", tenant.id)
    .eq("date", today);
  if (error) throw new Error(error.message);

  type Row = {
    staff_id: string;
    staff: { id: string; full_name: string; ratio_type: string; job_title: string | null } | null;
    shift_segment: { start_time: string; end_time: string }[];
  };
  const onNow = ((shifts ?? []) as unknown as Row[]).filter((s) =>
    s.shift_segment.some((seg) => {
      const start = timeToMinutes(seg.start_time);
      const end0 = timeToMinutes(seg.end_time);
      const end = end0 > start ? end0 : 1440; // overnight spillover
      return start <= nowMinutes && nowMinutes < end;
    })
  );

  if (onNow.length === 0) {
    console.log(
      `Nobody is scheduled at this moment (${today}, minute ${nowMinutes}).` +
      ` The pharmacy floor runs roughly 07:30–19:00 ${tenant.timezone};` +
      ` run this during those hours for a populated board.`
    );
    return;
  }

  const techs = onNow.filter((s) => s.staff?.ratio_type === "technician");
  const pharmacists = onNow.filter((s) => s.staff?.ratio_type === "pharmacist");
  console.log(`On the floor now: ${pharmacists.length} pharmacists, ${techs.length} technicians`);

  // A believable floor: a staggered lunch rotation among techs, one meeting,
  // one off-floor, and the documented desk-function techs not counting.
  const statuses: { staff_id: string; status: string; who: string }[] = [];
  const take = (pool: Row[], n: number) => pool.splice(0, n);

  const deskTitles = /inventory|billing|supervisor/i;
  const deskTechs = techs.filter((s) => deskTitles.test(s.staff?.job_title ?? ""));
  const floorTechs = techs.filter((s) => !deskTitles.test(s.staff?.job_title ?? ""));

  for (const s of deskTechs)
    statuses.push({ staff_id: s.staff_id, status: "non_tech_function", who: s.staff!.full_name });
  for (const s of take(floorTechs, 3))
    statuses.push({ staff_id: s.staff_id, status: "on_lunch", who: s.staff!.full_name });
  for (const s of take(floorTechs, 1))
    statuses.push({ staff_id: s.staff_id, status: "in_meeting", who: s.staff!.full_name });
  for (const s of take(floorTechs, 1))
    statuses.push({ staff_id: s.staff_id, status: "off_floor", who: s.staff!.full_name });

  // Idempotency: close ALL open rows for this tenant, then insert fresh.
  const nowIso = new Date().toISOString();
  await supabase
    .from("live_status")
    .update({ effective_to: nowIso })
    .eq("tenant_id", tenant.id)
    .is("effective_to", null);

  const { error: insErr } = await supabase.from("live_status").insert(
    statuses.map((s) => ({
      tenant_id: tenant.id,
      staff_id: s.staff_id,
      status: s.status,
      effective_from: nowIso,
    }))
  );
  if (insErr) throw new Error(insErr.message);

  console.log("\nSeeded live statuses:");
  for (const s of statuses) console.log(`  ${s.status.padEnd(18)} ${s.who}`);
  console.log(
    `\nEveryone else on the floor defaults to present_counting.` +
    `\nOpen /app/board — re-run this script any time to refresh the picture.`
  );
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
