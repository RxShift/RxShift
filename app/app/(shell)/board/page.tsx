import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getSession } from "@/lib/auth";
import PageHeader, { EmptyState } from "@/components/ui/page-header";
import LiveBoard from "@/components/app/board/live-board";
import { loadPeriodBundle, toEngineRule, toEngineSegments } from "@/lib/schedule-data";
import { evaluateZone, maxTechsAllowed, timeToMinutes } from "@/lib/engine/ratio";
import { adjustSegmentsForLive, currentSlotOf } from "@/lib/live-board";
import {
  countsByStatus,
  labelByStatus,
  resolveStatuses,
} from "@/lib/live-status-config";
import { nowInTimeZone } from "@/lib/dates";
import type {
  LiveStatus,
  LiveStatusConfig,
  SchedulePeriod,
  Staff,
} from "@/lib/types";

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

  const [{ data: liveStatuses }, { data: staff }, { data: statusCfg }] =
    await Promise.all([
      supabase.from("live_status").select("*").is("effective_to", null),
      supabase.from("staff").select("*").eq("active", true).order("full_name"),
      supabase.from("live_status_config").select("*"),
    ]);
  const live = (liveStatuses ?? []) as LiveStatus[];
  const liveByStaff = new Map(live.map((l) => [l.staff_id, l.status]));

  // Statuses are configurable per tenant (which to show, labels, and whether
  // each counts toward ratio). No config rows = the original built-in behavior.
  const cfgRows = (statusCfg ?? []) as LiveStatusConfig[];
  const countsCfg = countsByStatus(cfgRows);
  const labels = labelByStatus(cfgRows);
  const statusOptions = resolveStatuses(cfgRows)
    .filter((s) => s.enabled)
    .map((s) => ({ value: s.value, label: s.label }));
  // "Counting right now" = the person's current status isn't one this tenant
  // marks as non-counting (default fallback "Working" counts).
  const liveCounts = (staffId: string) =>
    countsCfg[liveByStaff.get(staffId) ?? "present_counting"] !== false;

  // Build today's per-zone picture from the schedule, then overlay live
  // status: anyone currently off the floor / at lunch / in a meeting / on
  // non-tech work does NOT count right now, whatever the schedule says.
  type BoardPerson = {
    name: string;
    staffId: string;
    live: string;
    color: string | null;
    workType: string | null;
  };
  const locationCards: {
    locationId: string;
    locationName: string;
    pharmacistsCounting: BoardPerson[];
    pharmacistsNotCounting: (BoardPerson & { reason: string })[];
    techsCounting: BoardPerson[];
    techsNotCounting: (BoardPerson & { reason: string })[];
    othersOnNow: BoardPerson[];
    status: "compliant" | "deficient";
    reason: string | null;
    techLimit: number;
    limitLabel: string;
  }[] = [];

  for (const period of todaysPeriods) {
    const bundle = await loadPeriodBundle(period.id);
    if (!bundle?.ratioRule) continue;
    const segments = toEngineSegments(bundle).filter((s) => s.date === today);

    const wtColorById = new Map(
      bundle.workTypes.map((w) => [w.id, w.color])
    );
    const colorOf = (s: (typeof segments)[number]) =>
      s.work_type ? (wtColorById.get(s.work_type.id) ?? null) : null;

    for (const location of bundle.locations) {
      const locSegs = segments.filter((s) => s.location_id === location.id);
      if (locSegs.length === 0) continue;

      // Apply live-status overrides for the current moment (shared with the
      // alert cron so the badge and the alert always agree).
      const adjusted = adjustSegmentsForLive(locSegs, liveByStaff, countsCfg);

      const evals = evaluateZone(
        adjusted,
        toEngineRule(bundle.ratioRule),
        tenant.ratio_slot_minutes
      );
      const currentSlot = currentSlotOf(evals.get(today) ?? [], nowMinutes);

      const onNow = locSegs.filter((seg) => {
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
        .filter((s) => liveCounts(s.staff.id))
        .map((s) => ({
          name: s.staff.full_name,
          staffId: s.staff.id,
          live: liveByStaff.get(s.staff.id) ?? "present_counting",
          color: colorOf(s),
          workType: s.work_type?.name ?? null,
        }));
      const pharmacistsNotCounting = pharmacistsAll
        .filter((s) => !liveCounts(s.staff.id))
        .map((s) => {
          const live = liveByStaff.get(s.staff.id)!;
          return {
            name: s.staff.full_name,
            staffId: s.staff.id,
            live,
            reason: labels[live] ?? live.replace(/_/g, " "),
            color: colorOf(s),
            workType: s.work_type?.name ?? null,
          };
        });
      const techs = onNow.filter((s) => s.staff.ratio_type === "technician");
      const techsCounting = techs
        .filter((s) => liveCounts(s.staff.id))
        .map((s) => ({
          name: s.staff.full_name,
          staffId: s.staff.id,
          live: liveByStaff.get(s.staff.id) ?? "present_counting",
          color: colorOf(s),
          workType: s.work_type?.name ?? null,
        }));
      const techsNotCounting = techs
        .filter((s) => !liveCounts(s.staff.id))
        .map((s) => {
          const live = liveByStaff.get(s.staff.id)!;
          return {
            name: s.staff.full_name,
            staffId: s.staff.id,
            live,
            reason: labels[live] ?? live.replace(/_/g, " "),
            color: colorOf(s),
            workType: s.work_type?.name ?? null,
          };
        });
      const othersOnNow = onNow
        .filter((s) => s.staff.ratio_type === "non_counting")
        .map((s) => ({
          name: s.staff.full_name,
          staffId: s.staff.id,
          live: liveByStaff.get(s.staff.id) ?? "present_counting",
          color: colorOf(s),
          workType: s.work_type?.name ?? null,
        }));

      const engineRule = toEngineRule(bundle.ratioRule);
      locationCards.push({
        locationId: location.id,
        locationName: location.name,
        pharmacistsCounting,
        pharmacistsNotCounting,
        techsCounting,
        techsNotCounting,
        othersOnNow,
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
          locations={locationCards}
          staff={(staff ?? []).map((s: Staff) => ({
            id: s.id,
            name: s.full_name,
            live: liveByStaff.get(s.id) ?? "present_counting",
          }))}
          isManager={["owner_admin", "scheduler", "supervisor"].includes(
            session!.appUser!.role
          )}
          statusOptions={statusOptions}
          labels={labels}
        />
      </div>
    </>
  );
}
