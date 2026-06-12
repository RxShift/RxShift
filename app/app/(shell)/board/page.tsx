import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import LiveBoard from "@/components/app/board/live-board";
import { loadPeriodBundle, toEngineRule, toEngineSegments } from "@/lib/schedule-data";
import { evaluateZone, maxTechsAllowed, timeToMinutes } from "@/lib/engine/ratio";
import { nowInTimeZone } from "@/lib/dates";
import type { LiveStatus, SchedulePeriod, Staff } from "@/lib/types";

export const dynamic = "force-dynamic";

// The live real-time ratio board — gated: only exists when the tenant has
// a ratio requirement (scoping §2.2: power-user compliance is opt-in).
export default async function LiveBoardPage() {
  const session = await getSession();
  const tenant = session!.tenant!;
  if (!tenant.has_ratio) redirect("/app/dashboard");

  const supabase = await createClient();
  // "Today" and "now" in the TENANT's timezone — the server clock (UTC on
  // Vercel) would otherwise blank the board outside its own business hours.
  const { date: today, minutes: nowMinutes } = nowInTimeZone(tenant.timezone);

  const { data: periods } = await supabase
    .from("schedule_period")
    .select("*")
    .lte("start_date", today)
    .gte("end_date", today);
  const todaysPeriods = (periods ?? []) as SchedulePeriod[];

  if (todaysPeriods.length === 0) {
    return (
      <>
        <PageHeader title="Live Board" />
        <div className="flex-1 p-8">
          <EmptyState message="No schedule period covers today, so there's nothing to monitor live. Publish a schedule that includes today first." />
        </div>
      </>
    );
  }

  const [{ data: liveStatuses }, { data: staff }] = await Promise.all([
    supabase.from("live_status").select("*").is("effective_to", null),
    supabase.from("staff").select("*").eq("active", true).order("full_name"),
  ]);
  const live = (liveStatuses ?? []) as LiveStatus[];
  const liveByStaff = new Map(live.map((l) => [l.staff_id, l.status]));

  // Build today's per-zone picture from the schedule, then overlay live
  // status: anyone currently off the floor / at lunch / in a meeting / on
  // non-tech work does NOT count right now, whatever the schedule says.
  const zoneCards: {
    zoneId: string;
    zoneName: string;
    pharmacistsCounting: { name: string; staffId: string; live: string }[];
    pharmacistsNotCounting: { name: string; staffId: string; live: string; reason: string }[];
    techsCounting: { name: string; staffId: string; live: string }[];
    techsNotCounting: { name: string; staffId: string; live: string; reason: string }[];
    status: "compliant" | "deficient";
    reason: string | null;
    techLimit: number;
    limitLabel: string;
  }[] = [];

  for (const period of todaysPeriods) {
    const bundle = await loadPeriodBundle(period.id);
    if (!bundle?.ratioRule) continue;
    const segments = toEngineSegments(bundle).filter((s) => s.date === today);

    for (const zone of bundle.zones) {
      const zoneSegs = segments.filter((s) => s.zone_id === zone.id);
      if (zoneSegs.length === 0) continue;

      // Apply live-status overrides for the current moment
      const adjusted = zoneSegs.map((seg) => {
        const liveStatus = liveByStaff.get(seg.staff.id);
        if (
          liveStatus &&
          liveStatus !== "present_counting" &&
          seg.staff.ratio_type !== "non_counting"
        ) {
          return { ...seg, counts_override: false };
        }
        return seg;
      });

      const evals = evaluateZone(
        adjusted,
        toEngineRule(bundle.ratioRule),
        tenant.ratio_slot_minutes
      );
      const slots = evals.get(today) ?? [];
      const currentSlot = slots.find(
        (s) =>
          s.slot_start <= nowMinutes &&
          nowMinutes < s.slot_start + s.slot_minutes
      );

      const onNow = zoneSegs.filter((seg) => {
        const start = timeToMinutes(seg.start_time);
        const end0 = timeToMinutes(seg.end_time);
        const end = end0 > start ? end0 : 1440;
        return start <= nowMinutes && nowMinutes < end;
      });

      // Pharmacists get the same counting / not-counting split as techs —
      // a pharmacist at lunch shouldn't inflate the headline count
      const pharmacistsAll = onNow.filter(
        (s) => s.staff.ratio_type === "pharmacist"
      );
      const pharmacistsCounting = pharmacistsAll
        .filter(
          (s) =>
            (liveByStaff.get(s.staff.id) ?? "present_counting") ===
            "present_counting"
        )
        .map((s) => ({
          name: s.staff.full_name,
          staffId: s.staff.id,
          live: "present_counting",
        }));
      const pharmacistsNotCounting = pharmacistsAll
        .filter(
          (s) =>
            (liveByStaff.get(s.staff.id) ?? "present_counting") !==
            "present_counting"
        )
        .map((s) => ({
          name: s.staff.full_name,
          staffId: s.staff.id,
          live: liveByStaff.get(s.staff.id)!,
          reason: liveByStaff.get(s.staff.id)!.replace(/_/g, " "),
        }));
      const techs = onNow.filter((s) => s.staff.ratio_type === "technician");
      const techsCounting = techs
        .filter(
          (s) =>
            (liveByStaff.get(s.staff.id) ?? "present_counting") ===
            "present_counting"
        )
        .map((s) => ({
          name: s.staff.full_name,
          staffId: s.staff.id,
          live: "present_counting",
        }));
      const techsNotCounting = techs
        .filter(
          (s) =>
            (liveByStaff.get(s.staff.id) ?? "present_counting") !==
            "present_counting"
        )
        .map((s) => ({
          name: s.staff.full_name,
          staffId: s.staff.id,
          live: liveByStaff.get(s.staff.id)!,
          reason: liveByStaff.get(s.staff.id)!.replace(/_/g, " "),
        }));

      const engineRule = toEngineRule(bundle.ratioRule);
      zoneCards.push({
        zoneId: zone.id,
        zoneName: zone.name,
        pharmacistsCounting,
        pharmacistsNotCounting,
        techsCounting,
        techsNotCounting,
        status: currentSlot?.status ?? "compliant",
        reason: currentSlot?.deficiency_reason ?? null,
        techLimit: maxTechsAllowed(pharmacistsCounting.length, engineRule),
        limitLabel:
          engineRule.formula === "additive"
            ? `additive: first +${engineRule.additive_first_techs ?? 1}, each addl +${engineRule.additive_additional_techs ?? 2}`
            : `${bundle.ratioRule.max_techs_per_pharmacist}/pharmacist`,
      });
    }
  }

  return (
    <>
      <PageHeader title="Live Board" />
      <div className="flex-1 p-8">
        <LiveBoard
          zones={zoneCards}
          staff={(staff ?? []).map((s: Staff) => ({
            id: s.id,
            name: s.full_name,
            live: liveByStaff.get(s.id) ?? "present_counting",
          }))}
          isManager={["owner_admin", "scheduler", "supervisor"].includes(
            session!.appUser!.role
          )}
        />
      </div>
    </>
  );
}
