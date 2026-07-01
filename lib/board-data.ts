// Shared live-board data builder. Used by BOTH the in-shell board
// (app/app/(shell)/board/page.tsx) and the chrome-free wall display
// (app/app/(kiosk)/display/page.tsx) so the two can never disagree.
//
// Reads today's published schedule (tenant tz), overlays live status, and
// returns per-location cards + a per-person status list that now also carries
// each on-shift person's current location (for grouping the status board).
import type {
  Tenant,
  LiveStatus,
  LiveStatusConfig,
  SchedulePeriod,
  Staff,
} from "@/lib/types";
import {
  loadPeriodBundle,
  engineRuleForLocation,
  toEngineSegments,
} from "@/lib/schedule-data";
import {
  evaluateZone,
  maxTechsAllowed,
  pharmacistHeadroom,
  timeToMinutes,
} from "@/lib/engine/ratio";
import { adjustSegmentsForLive, currentSlotOf } from "@/lib/live-board";
import {
  countsByStatus,
  labelByStatus,
  resolveStatuses,
} from "@/lib/live-status-config";
import { nowInTimeZone, dateInTimeZone, demoClockMinutes } from "@/lib/dates";
import type { createClient } from "@/lib/supabase/server";

export interface BoardPerson {
  name: string;
  staffId: string;
  live: string;
  color: string | null;
  workType: string | null;
}

export interface LocationCard {
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
  /** How many counting pharmacists could step away now and stay compliant. */
  headroom: number;
}

export interface StatusListItem {
  id: string;
  name: string;
  live: string;
  offShift: boolean;
  /** True when an active call-out removes this person from today's coverage. */
  calledOut: boolean;
  /** The location of the person's current shift, or null if off shift. */
  locationId: string | null;
  locationName: string | null;
}

export interface BoardView {
  /** True when no schedule period covers today — the page shows an empty state. */
  noPeriodToday: boolean;
  locationCards: LocationCard[];
  statusList: StatusListItem[];
  statusOptions: { value: string; label: string }[];
  labels: Record<string, string>;
}

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

export async function buildBoardView(
  supabase: SupabaseServerClient,
  tenant: Tenant
): Promise<BoardView> {
  // "Today" and "now" in the TENANT's timezone — the server clock (UTC on
  // Vercel) would otherwise blank the board outside its own business hours.
  const { date: today, minutes: nowMinutes } = nowInTimeZone(
    tenant.timezone,
    demoClockMinutes(tenant.demo_clock)
  );

  const { data: periods } = await supabase
    .from("schedule_period")
    .select("*")
    .lte("start_date", today)
    .gte("end_date", today);
  const todaysPeriods = (periods ?? []) as SchedulePeriod[];

  const [
    { data: liveStatuses },
    { data: staff },
    { data: statusCfg },
    { data: calloutRows },
  ] = await Promise.all([
    supabase.from("live_status").select("*").is("effective_to", null),
    supabase.from("staff").select("*").eq("active", true).order("full_name"),
    supabase.from("live_status_config").select("*"),
    // Active call-outs for today remove the person from coverage: they don't
    // count toward the ratio and show as "Called out" (not a bare "Off shift").
    supabase
      .from("callout")
      .select("staff_id")
      .eq("callout_date", today)
      .is("reversed_at", null),
  ]);
  const calledOutStaffIds = new Set(
    ((calloutRows ?? []) as { staff_id: string }[]).map((r) => r.staff_id)
  );

  // Only honor a status set TODAY (tenant tz) — yesterday's "Lunch" shouldn't
  // linger (live_status rows stay open with effective_to null).
  const live = ((liveStatuses ?? []) as LiveStatus[]).filter(
    (l) => dateInTimeZone(l.effective_from, tenant.timezone) === today
  );
  const liveByStaff = new Map(live.map((l) => [l.staff_id, l.status]));
  // Staff with a PUBLISHED shift covering right now = "on shift".
  const onShiftStaffIds = new Set<string>();
  // Where each on-shift person is working right now (first current location).
  const staffLocation = new Map<
    string,
    { locationId: string; locationName: string }
  >();

  const cfgRows = (statusCfg ?? []) as LiveStatusConfig[];
  const countsCfg = countsByStatus(cfgRows);
  const labels = labelByStatus(cfgRows);
  const statusOptions = resolveStatuses(cfgRows)
    .filter((s) => s.enabled)
    .map((s) => ({ value: s.value, label: s.label }));
  const liveCounts = (staffId: string) =>
    countsCfg[liveByStaff.get(staffId) ?? "present_counting"] !== false;

  const locationCards: LocationCard[] = [];

  for (const period of todaysPeriods) {
    const bundle = await loadPeriodBundle(period.id);
    if (!bundle?.ratioRule) continue;
    // PUBLISHED shifts only — the live board reflects the real schedule, not drafts.
    const publishedIds = new Set(
      bundle.shifts.filter((s) => s.status === "published").map((s) => s.id)
    );
    const segments = toEngineSegments(bundle).filter(
      (s) =>
        s.date === today &&
        publishedIds.has(s.shift_id) &&
        !calledOutStaffIds.has(s.staff.id)
    );

    const wtColorById = new Map(bundle.workTypes.map((w) => [w.id, w.color]));
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
        engineRuleForLocation(bundle.ratioRule, location, tenant),
        tenant.ratio_slot_minutes
      );
      const currentSlot = currentSlotOf(evals.get(today) ?? [], nowMinutes);

      const onNow = locSegs.filter((seg) => {
        const start = timeToMinutes(seg.start_time);
        const end0 = timeToMinutes(seg.end_time);
        const end = end0 > start ? end0 : 1440;
        return start <= nowMinutes && nowMinutes < end;
      });
      for (const seg of onNow) {
        onShiftStaffIds.add(seg.staff.id);
        if (!staffLocation.has(seg.staff.id))
          staffLocation.set(seg.staff.id, {
            locationId: location.id,
            locationName: location.name,
          });
      }

      // Pharmacists get the same counting / not-counting split as techs —
      // a pharmacist at lunch shouldn't inflate the headline count.
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

      const engineRule = engineRuleForLocation(bundle.ratioRule, location, tenant);
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
            : // Use the EFFECTIVE per-pharmacist ceiling (engineRule), not the
              // stored base rule — so when R072-25 overlays a 4-tech ceiling the
              // label ("4/pharmacist") matches the computed limit, instead of
              // printing the stored NAC 639.250 base (3).
              `${engineRule.max_techs_per_pharmacist}/pharmacist`,
        headroom: pharmacistHeadroom(
          pharmacistsCounting.length,
          techsCounting.length,
          engineRule
        ),
      });
    }
  }

  const statusList: StatusListItem[] = (staff ?? []).map((s: Staff) => {
    const loc = staffLocation.get(s.id);
    return {
      id: s.id,
      name: s.full_name,
      live: liveByStaff.get(s.id) ?? "present_counting",
      offShift: !onShiftStaffIds.has(s.id),
      calledOut: calledOutStaffIds.has(s.id),
      locationId: loc?.locationId ?? null,
      locationName: loc?.locationName ?? null,
    };
  });

  return {
    noPeriodToday: todaysPeriods.length === 0,
    locationCards,
    statusList,
    statusOptions,
    labels,
  };
}
