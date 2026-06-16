import "server-only";

// Shared live-board evaluation. Both the live board page and the out-of-ratio
// alert cron run through these helpers so the badge you see and the alert you
// get can never disagree. The counting decision reads each tenant's configured
// statuses (lib/live-status-config), so flipping a status to count/not-count
// affects the board and the alerts identically.

import type { SupabaseClient } from "@supabase/supabase-js";
import { loadPeriodBundle, toEngineRule, toEngineSegments } from "@/lib/schedule-data";
import { evaluateZone } from "@/lib/engine/ratio";
import { nowInTimeZone } from "@/lib/dates";
import { countsByStatus } from "@/lib/live-status-config";
import type { EngineSegment, SlotEval } from "@/lib/engine/types";
import type {
  LiveStatus,
  LiveStatusConfig,
  SchedulePeriod,
  Tenant,
} from "@/lib/types";

export interface LiveLocationEval {
  locationId: string;
  locationName: string;
  status: "compliant" | "deficient";
  reason: string | null;
}

/**
 * Override segments for the current moment: anyone whose current live status
 * does NOT count is forced not-counting, whatever the schedule says. A status
 * that DOES count is left untouched so the engine still applies the normal
 * work-type / staff-type rule (we never force a non-counting work type to
 * count).
 */
export function adjustSegmentsForLive(
  segs: EngineSegment[],
  liveByStaff: Map<string, string>,
  countsCfg: Record<string, boolean>
): EngineSegment[] {
  return segs.map((seg) => {
    const live = liveByStaff.get(seg.staff.id);
    if (
      live &&
      countsCfg[live] === false &&
      seg.staff.ratio_type !== "non_counting"
    ) {
      return { ...seg, counts_override: false };
    }
    return seg;
  });
}

/** The slot covering `nowMinutes`, if any. */
export function currentSlotOf(
  slots: SlotEval[],
  nowMinutes: number
): SlotEval | undefined {
  return slots.find(
    (s) => s.slot_start <= nowMinutes && nowMinutes < s.slot_start + s.slot_minutes
  );
}

/**
 * Evaluate every LOCATION's CURRENT slot for a tenant. Used by the alert cron
 * (with a service-role client). Ratio is per location — all counting staff at a
 * location count together. Returns one entry per location with shifts scheduled
 * for the current moment.
 */
export async function evaluateLiveLocations(
  tenant: Tenant,
  supabase: SupabaseClient
): Promise<LiveLocationEval[]> {
  const { date: today, minutes: nowMinutes } = nowInTimeZone(tenant.timezone);

  const [{ data: periods }, { data: liveStatuses }, { data: cfg }, { data: locations }] =
    await Promise.all([
      supabase
        .from("schedule_period")
        .select("*")
        .eq("tenant_id", tenant.id)
        .lte("start_date", today)
        .gte("end_date", today),
      supabase
        .from("live_status")
        .select("*")
        .eq("tenant_id", tenant.id)
        .is("effective_to", null),
      supabase.from("live_status_config").select("*").eq("tenant_id", tenant.id),
      supabase.from("location").select("id, name").eq("tenant_id", tenant.id),
    ]);

  const liveByStaff = new Map(
    ((liveStatuses ?? []) as LiveStatus[]).map((l) => [l.staff_id, l.status])
  );
  const countsCfg = countsByStatus((cfg ?? []) as LiveStatusConfig[]);
  const locName = new Map(
    ((locations ?? []) as { id: string; name: string }[]).map((l) => [l.id, l.name])
  );

  // One result per location; if more than one period covers today for a
  // location, a deficiency in any of them wins.
  const byLocation = new Map<string, LiveLocationEval>();
  for (const period of (periods ?? []) as SchedulePeriod[]) {
    const bundle = await loadPeriodBundle(period.id, supabase);
    if (!bundle?.ratioRule) continue;
    const segments = toEngineSegments(bundle).filter((s) => s.date === today);
    if (segments.length === 0) continue;
    const adjusted = adjustSegmentsForLive(segments, liveByStaff, countsCfg);
    const evals = evaluateZone(
      adjusted,
      toEngineRule(bundle.ratioRule),
      tenant.ratio_slot_minutes
    );
    const slot = currentSlotOf(evals.get(today) ?? [], nowMinutes);
    const status = slot?.status ?? "compliant";
    const prev = byLocation.get(period.location_id);
    if (!prev || (status === "deficient" && prev.status !== "deficient")) {
      byLocation.set(period.location_id, {
        locationId: period.location_id,
        locationName: locName.get(period.location_id) ?? "Location",
        status,
        reason: slot?.deficiency_reason ?? null,
      });
    }
  }
  return [...byLocation.values()];
}
