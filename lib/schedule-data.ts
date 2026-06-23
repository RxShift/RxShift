import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { evaluateZone, minutesToTime, segmentCounts } from "@/lib/engine/ratio";
import { buildEngineRule, type RuleContext } from "@/lib/engine/rule";
import { evaluateConstraints, detectDoubleBookings } from "@/lib/engine/constraints";
import {
  generateComplianceRecord,
  deficiencyStreaks,
} from "@/lib/engine/compliance";
import type {
  ComplianceRecordRow,
  ConstraintRule,
  Location,
  PtoDay,
  RatioRule,
  SchedulePeriod,
  Shift,
  ShiftSegment,
  Staff,
  Tenant,
  TimeOffRequest,
  WorkType,
} from "@/lib/types";
import type { ConstraintFlag, EngineSegment } from "@/lib/engine/types";

export interface ShiftWithSegments extends Shift {
  segments: ShiftSegment[];
}

export interface PeriodBundle {
  period: SchedulePeriod;
  shifts: ShiftWithSegments[];
  staff: Staff[];
  workTypes: WorkType[];
  /** Locations referenced by this bundle (ratio is computed per location). */
  locations: Location[];
  ratioRule: RatioRule | null;
  constraints: ConstraintRule[];
  approvedTimeOff: TimeOffRequest[];
  /** Direct PTO records (scheduler-entered or written on time-off approval). */
  ptoDays: PtoDay[];
}

export interface RatioFlagOut {
  location_id: string;
  location_name: string;
  date: string;
  slot_label: string; // "14:00–14:30"
  reason: string;
}

export interface ValidationOut {
  ratioFlags: RatioFlagOut[];
  constraintFlags: ConstraintFlag[];
  /** dates (per location) that contain at least one deficient slot */
  deficientCells: { [locationId: string]: string[] };
}

/**
 * Fetch EVERY row of a query, paging past Supabase/PostgREST's 1000-row response
 * cap. Without this, a busy month / all-locations window silently truncates:
 * shifts past row 1000 vanish from the grid, and a copy-forward that fetched all
 * segments in one shot created shifts with NO segments (the phantom "SMRX"
 * cells). Pass a builder that applies `.range(from, to)`; we page until a short
 * page comes back. Give the query a stable `.order()` so pages don't overlap.
 */
export async function fetchAllRows<T>(
  page: (
    from: number,
    to: number
  ) => PromiseLike<{ data: T[] | null; error?: unknown }>
): Promise<T[]> {
  const SIZE = 1000;
  const out: T[] = [];
  for (let from = 0; ; from += SIZE) {
    const { data, error } = await page(from, from + SIZE - 1);
    // Don't fail silently: a page error (e.g. a too-long URL) used to return []
    // and quietly drop rows — which is exactly how the grid lost shifts.
    if (error) {
      console.error("[fetchAllRows] page error:", error);
      throw error;
    }
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < SIZE) break;
  }
  return out;
}

/**
 * Fetch the segments for a set of shifts, CHUNKING the id list so the
 * `shift_id=in.(…)` URL never grows past PostgREST's request limit. A month /
 * all-locations window can reference 750+ shifts; one giant `.in(…)` returns a
 * 400 (URI too long) — which used to leave every shift with no segments, so the
 * grid showed only their location tag (or, with the empty-shift guard, nothing).
 * Small chunks keep each URL short; we run them in parallel and flatten.
 */
export async function fetchSegmentsByShiftIds(
  supabase: SupabaseClient,
  shiftIds: string[]
): Promise<ShiftSegment[]> {
  if (shiftIds.length === 0) return [];
  const CHUNK = 100; // ~100 uuids per URL stays well under the limit
  const batches: string[][] = [];
  for (let i = 0; i < shiftIds.length; i += CHUNK)
    batches.push(shiftIds.slice(i, i + CHUNK));
  const perBatch = await Promise.all(
    batches.map((ids) =>
      fetchAllRows<ShiftSegment>((from, to) =>
        supabase
          .from("shift_segment")
          .select("*")
          .in("shift_id", ids)
          .order("id")
          .range(from, to)
      )
    )
  );
  return perBatch.flat();
}

export async function loadPeriodBundle(
  periodId: string,
  client?: SupabaseClient
): Promise<PeriodBundle | null> {
  const supabase = client ?? (await createClient());

  const { data: period } = await supabase
    .from("schedule_period")
    .select("*")
    .eq("id", periodId)
    .maybeSingle();
  if (!period) return null;

  const [
    { data: shifts },
    { data: segments },
    { data: staff },
    { data: workTypes },
    { data: locations },
    { data: rules },
    { data: constraints },
    { data: timeOff },
    { data: ptoDays },
  ] = await Promise.all([
    supabase.from("shift").select("*").eq("schedule_period_id", periodId),
    supabase
      .from("shift_segment")
      .select("*, shift!inner(schedule_period_id)")
      .eq("shift.schedule_period_id", periodId),
    // tenant_id filters are redundant under RLS (auth client) but REQUIRED when
    // this runs with the service-role client (the live-ratio cron), which
    // bypasses RLS — without them these would return every tenant's rows.
    supabase
      .from("staff")
      .select("*")
      .eq("tenant_id", period.tenant_id)
      .order("full_name"),
    supabase
      .from("work_type")
      .select("*")
      .eq("tenant_id", period.tenant_id)
      .order("name"),
    supabase.from("location").select("*").eq("id", period.location_id),
    supabase.from("ratio_rule").select("*").eq("tenant_id", period.tenant_id),
    supabase
      .from("constraint_rule")
      .select("*")
      .eq("tenant_id", period.tenant_id)
      .eq("active", true),
    supabase
      .from("time_off_request")
      .select("*")
      .eq("tenant_id", period.tenant_id)
      .eq("status", "approved")
      .lte("start_date", period.end_date)
      .gte("end_date", period.start_date),
    supabase
      .from("pto_day")
      .select("*")
      .eq("tenant_id", period.tenant_id)
      .gte("date", period.start_date)
      .lte("date", period.end_date),
  ]);

  const segsByShift = new Map<string, ShiftSegment[]>();
  for (const seg of segments ?? []) {
    const list = segsByShift.get(seg.shift_id) ?? [];
    list.push(seg as ShiftSegment);
    segsByShift.set(seg.shift_id, list);
  }

  const allRules = (rules ?? []) as RatioRule[];
  const tenantRule = allRules.find((r) => r.tenant_id !== null) ?? null;

  return {
    period: period as SchedulePeriod,
    shifts: ((shifts ?? []) as Shift[]).map((s) => ({
      ...s,
      segments: (segsByShift.get(s.id) ?? []).sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      ),
    })),
    staff: (staff ?? []) as Staff[],
    workTypes: (workTypes ?? []) as WorkType[],
    locations: (locations ?? []) as Location[],
    ratioRule: tenantRule,
    constraints: (constraints ?? []) as ConstraintRule[],
    approvedTimeOff: (timeOff ?? []) as TimeOffRequest[],
    ptoDays: (ptoDays ?? []) as PtoDay[],
  };
}

// ─── Range bundle (view selector: week / 2-week / month across periods) ──────
//
// Build is per-period (the publish unit); VIEW is decoupled. A range can span
// several built periods, so we fetch shifts by date range + location instead of
// by a single period id. Each shift keeps its schedule_period_id, so editing a
// cell still resolves to the right underlying period.

export interface RangeBundle {
  locationId: string;
  viewStart: string;
  viewEnd: string;
  periods: SchedulePeriod[]; // periods for this location overlapping the window
  shifts: ShiftWithSegments[];
  staff: Staff[];
  workTypes: WorkType[];
  locations: Location[];
  ratioRule: RatioRule | null;
  constraints: ConstraintRule[];
  approvedTimeOff: TimeOffRequest[];
  /** Direct PTO records (scheduler-entered or written on time-off approval). */
  ptoDays: PtoDay[];
}

export async function loadRangeBundle(
  locationId: string,
  viewStart: string,
  viewEnd: string
): Promise<RangeBundle> {
  const supabase = await createClient();

  // Paginated: a busy window can exceed the 1000-row cap (see fetchAllRows).
  const shiftRows = await fetchAllRows<Shift>((from, to) =>
    supabase
      .from("shift")
      .select("*")
      .eq("location_id", locationId)
      .gte("date", viewStart)
      .lte("date", viewEnd)
      .order("id")
      .range(from, to)
  );
  const shiftIds = shiftRows.map((s) => s.id);

  const [
    segments,
    { data: staff },
    { data: workTypes },
    { data: locations },
    { data: rules },
    { data: constraints },
    { data: timeOff },
    { data: ptoDays },
    { data: periods },
  ] = await Promise.all([
    fetchSegmentsByShiftIds(supabase, shiftIds),
    supabase.from("staff").select("*").order("full_name"),
    supabase.from("work_type").select("*").order("name"),
    supabase.from("location").select("*").eq("id", locationId),
    supabase.from("ratio_rule").select("*"),
    supabase.from("constraint_rule").select("*").eq("active", true),
    supabase
      .from("time_off_request")
      .select("*")
      .eq("status", "approved")
      .lte("start_date", viewEnd)
      .gte("end_date", viewStart),
    supabase
      .from("pto_day")
      .select("*")
      .gte("date", viewStart)
      .lte("date", viewEnd),
    supabase
      .from("schedule_period")
      .select("*")
      .eq("location_id", locationId)
      .lte("start_date", viewEnd)
      .gte("end_date", viewStart)
      .order("start_date"),
  ]);

  const segsByShift = new Map<string, ShiftSegment[]>();
  for (const seg of segments) {
    const list = segsByShift.get(seg.shift_id) ?? [];
    list.push(seg);
    segsByShift.set(seg.shift_id, list);
  }

  const allRules = (rules ?? []) as RatioRule[];
  const tenantRule = allRules.find((r) => r.tenant_id !== null) ?? null;

  return {
    locationId,
    viewStart,
    viewEnd,
    periods: (periods ?? []) as SchedulePeriod[],
    shifts: shiftRows.map((s) => ({
      ...s,
      segments: (segsByShift.get(s.id) ?? []).sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      ),
    })),
    staff: (staff ?? []) as Staff[],
    workTypes: (workTypes ?? []) as WorkType[],
    locations: (locations ?? []) as Location[],
    ratioRule: tenantRule,
    constraints: (constraints ?? []) as ConstraintRule[],
    approvedTimeOff: (timeOff ?? []) as TimeOffRequest[],
    ptoDays: (ptoDays ?? []) as PtoDay[],
  };
}

// ─── All-locations bundle (the unified, person-centric matrix) ───────────────
//
// Same shape as a range bundle but spanning EVERY location: ratio is per
// location, and a person may work at more than one. We load all shifts in the
// window (no location filter), group by person at render time, and tag each
// shift with its location. Validation still groups by location, and the
// double-book check (validateBundle) flags a person scheduled in two overlapping
// shifts across locations.
export async function loadAllLocationsBundle(
  viewStart: string,
  viewEnd: string
): Promise<RangeBundle> {
  const supabase = await createClient();

  // Paginated: an all-locations month easily exceeds the 1000-row cap (see
  // fetchAllRows) — without paging, shifts AND their segments silently vanish.
  const shiftRows = await fetchAllRows<Shift>((from, to) =>
    supabase
      .from("shift")
      .select("*")
      .gte("date", viewStart)
      .lte("date", viewEnd)
      .order("id")
      .range(from, to)
  );
  const shiftIds = shiftRows.map((s) => s.id);

  const [
    segments,
    { data: staff },
    { data: workTypes },
    { data: locations },
    { data: rules },
    { data: constraints },
    { data: timeOff },
    { data: ptoDays },
    { data: periods },
  ] = await Promise.all([
    fetchSegmentsByShiftIds(supabase, shiftIds),
    supabase.from("staff").select("*").order("full_name"),
    supabase.from("work_type").select("*").order("name"),
    supabase.from("location").select("*").order("name"),
    supabase.from("ratio_rule").select("*"),
    supabase.from("constraint_rule").select("*").eq("active", true),
    supabase
      .from("time_off_request")
      .select("*")
      .eq("status", "approved")
      .lte("start_date", viewEnd)
      .gte("end_date", viewStart),
    supabase
      .from("pto_day")
      .select("*")
      .gte("date", viewStart)
      .lte("date", viewEnd),
    supabase
      .from("schedule_period")
      .select("*")
      .lte("start_date", viewEnd)
      .gte("end_date", viewStart)
      .order("start_date"),
  ]);

  const segsByShift = new Map<string, ShiftSegment[]>();
  for (const seg of segments) {
    const list = segsByShift.get(seg.shift_id) ?? [];
    list.push(seg);
    segsByShift.set(seg.shift_id, list);
  }

  const allRules = (rules ?? []) as RatioRule[];
  const tenantRule = allRules.find((r) => r.tenant_id !== null) ?? null;

  return {
    locationId: "", // spans all locations
    viewStart,
    viewEnd,
    periods: (periods ?? []) as SchedulePeriod[],
    shifts: shiftRows.map((s) => ({
      ...s,
      segments: (segsByShift.get(s.id) ?? []).sort((a, b) =>
        a.start_time.localeCompare(b.start_time)
      ),
    })),
    staff: (staff ?? []) as Staff[],
    workTypes: (workTypes ?? []) as WorkType[],
    locations: (locations ?? []) as Location[],
    ratioRule: tenantRule,
    constraints: (constraints ?? []) as ConstraintRule[],
    approvedTimeOff: (timeOff ?? []) as TimeOffRequest[],
    ptoDays: (ptoDays ?? []) as PtoDay[],
  };
}

/**
 * Validate a range the same way a period is validated. The engine works
 * per-date/per-zone and never reads the period identity, so a synthetic period
 * spanning the whole window is safe — no engine change needed.
 */
export function validateRangeBundle(
  range: RangeBundle,
  tenant: Tenant
): ValidationOut {
  const pseudo: PeriodBundle = {
    period: {
      id: "range",
      tenant_id: tenant.id,
      location_id: range.locationId,
      cycle: tenant.schedule_cycle,
      start_date: range.viewStart,
      end_date: range.viewEnd,
      status: "draft",
      published_at: null,
      published_by: null,
      created_at: "",
    },
    shifts: range.shifts,
    staff: range.staff,
    workTypes: range.workTypes,
    locations: range.locations,
    ratioRule: range.ratioRule,
    constraints: range.constraints,
    approvedTimeOff: range.approvedTimeOff,
    ptoDays: range.ptoDays,
  };
  return validateBundle(pseudo, tenant);
}

/**
 * Full rule subset for the engine — keeps additive-formula fields intact, and
 * applies the state/location-aware overlays:
 *  • Tennessee (rule.state === 'TN'): certified techs are uncapped.
 *  • Nevada R072-25 (toggle on + retail location): 4-tech ceiling + 2-trainee
 *    sublimit + the solo-pharmacist floor (1, or 2 with a drive-through).
 * With no ctx (or a non-retail location / toggle off), this returns exactly the
 * pre-R072-25 behavior, so existing tenants are unchanged.
 */
export function toEngineRule(rule: RatioRule, ctx?: RuleContext) {
  return buildEngineRule(rule, ctx);
}

/** Build the engine rule for a specific location, applying the tenant's R072-25
 *  toggle + the location's type/drive-through. Use this everywhere ratio is
 *  evaluated per location so the floor/ceiling overlays are consistent. */
export function engineRuleForLocation(
  rule: RatioRule,
  location:
    | Pick<Location, "location_type" | "has_drive_through">
    | undefined,
  tenant: Tenant
) {
  return toEngineRule(rule, {
    locationType: location?.location_type,
    hasDriveThrough: location?.has_drive_through,
    r072Enabled: tenant.nevada_r072_25,
  });
}

export function toEngineSegments(bundle: PeriodBundle): EngineSegment[] {
  const staffById = new Map(bundle.staff.map((s) => [s.id, s]));
  const wtById = new Map(bundle.workTypes.map((w) => [w.id, w]));
  const out: EngineSegment[] = [];

  for (const shift of bundle.shifts) {
    const person = staffById.get(shift.staff_id);
    if (!person) continue;
    for (const seg of shift.segments) {
      const wt = seg.work_type_id ? (wtById.get(seg.work_type_id) ?? null) : null;
      out.push({
        shift_id: shift.id,
        location_id: shift.location_id,
        date: shift.date,
        break_minutes: shift.break_minutes ?? 0,
        start_time: String(seg.start_time).slice(0, 5),
        end_time: String(seg.end_time).slice(0, 5),
        staff: {
          id: person.id,
          full_name: person.full_name,
          ratio_type: person.ratio_type,
          is_trainee: person.staff_type === "tech_in_training",
          certified: person.certified,
        },
        work_type: wt
          ? {
              id: wt.id,
              name: wt.name,
              counts_as: wt.counts_as,
              counting_default: wt.counting_default,
            }
          : null,
        counts_override: seg.counts_toward_ratio,
      });
    }
  }
  return out;
}

export function validateBundle(
  bundle: PeriodBundle,
  tenant: Tenant
): ValidationOut {
  const segments = toEngineSegments(bundle);
  const ratioFlags: RatioFlagOut[] = [];
  const deficientCells: { [locationId: string]: string[] } = {};
  const locationName = new Map(bundle.locations.map((l) => [l.id, l.name]));
  const locationById = new Map(bundle.locations.map((l) => [l.id, l]));

  if (tenant.has_ratio && bundle.ratioRule) {
    // Ratio is per LOCATION: all counting staff at a location count together.
    const byLocation = new Map<string, EngineSegment[]>();
    for (const seg of segments) {
      const list = byLocation.get(seg.location_id) ?? [];
      list.push(seg);
      byLocation.set(seg.location_id, list);
    }
    for (const [locationId, locSegs] of byLocation) {
      const evals = evaluateZone(
        locSegs,
        engineRuleForLocation(bundle.ratioRule, locationById.get(locationId), tenant),
        tenant.ratio_slot_minutes
      );
      for (const [date, slots] of evals) {
        for (const slot of slots) {
          if (slot.status === "deficient") {
            ratioFlags.push({
              location_id: locationId,
              location_name: locationName.get(locationId) ?? "Location",
              date,
              slot_label: `${minutesToTime(slot.slot_start)}–${minutesToTime(slot.slot_start + slot.slot_minutes)}`,
              reason: slot.deficiency_reason ?? "deficient",
            });
            const cells = deficientCells[locationId] ?? [];
            if (!cells.includes(date)) cells.push(date);
            deficientCells[locationId] = cells;
          }
        }
      }
    }
  }

  // PTO conflict: a shift on a day the person is off — a direct PTO day OR an
  // approved time-off range. The engine treats PTO as the ABSENCE of a shift and
  // never reads it, so we surface the overlap HERE (validation layer) as a flag;
  // it doesn't touch ratio math. Joining constraintFlags means it shows in Open
  // Flags and gates publish for free; the matrix renders the shift in the red
  // deficiency treatment (this is a hard conflict, not a soft constraint).
  const staffNameById = new Map(bundle.staff.map((s) => [s.id, s.full_name]));
  const ptoDateKeys = new Set(
    bundle.ptoDays.map((p) => `${p.staff_id}|${p.date}`)
  );
  const ptoConflicts: ConstraintFlag[] = [];
  for (const shift of bundle.shifts) {
    if (shift.segments.length === 0) continue; // ignore empty-shell artifacts
    const onPtoDay = ptoDateKeys.has(`${shift.staff_id}|${shift.date}`);
    const onApprovedTimeOff = bundle.approvedTimeOff.some(
      (t) =>
        t.staff_id === shift.staff_id &&
        t.start_date <= shift.date &&
        t.end_date >= shift.date
    );
    if (!onPtoDay && !onApprovedTimeOff) continue;
    const name = staffNameById.get(shift.staff_id) ?? "This person";
    ptoConflicts.push({
      rule_id: "pto_conflict",
      rule_type: "pto_conflict",
      staff_id: shift.staff_id,
      staff_name: name,
      shift_id: shift.id,
      date: shift.date,
      message: `${name} is scheduled on ${shift.date} but is marked off that day (${onApprovedTimeOff ? "approved time off" : "PTO"}). Remove the time off or the shift.`,
    });
  }

  const constraintFlags = [
    ...evaluateConstraints(bundle.constraints, segments),
    ...detectDoubleBookings(segments),
    ...ptoConflicts,
  ];

  return { ratioFlags, constraintFlags, deficientCells };
}

/** Generate compliance record rows for every location in a bundle. */
export function buildComplianceRecords(
  bundle: PeriodBundle,
  tenant: Tenant
): { location: Location; rows: ComplianceRecordRow[] }[] {
  if (!bundle.ratioRule) return [];
  const segments = toEngineSegments(bundle);
  const byLocation = new Map<string, EngineSegment[]>();
  for (const seg of segments) {
    const list = byLocation.get(seg.location_id) ?? [];
    list.push(seg);
    byLocation.set(seg.location_id, list);
  }

  const out: { location: Location; rows: ComplianceRecordRow[] }[] = [];
  for (const location of bundle.locations) {
    const locSegs = byLocation.get(location.id) ?? [];
    if (locSegs.length === 0) continue;
    const evals = evaluateZone(
      locSegs,
      engineRuleForLocation(bundle.ratioRule, location, tenant),
      tenant.ratio_slot_minutes
    );
    out.push({
      location,
      rows: generateComplianceRecord(evals, location.id, location.name),
    });
  }
  return out;
}

export { deficiencyStreaks, segmentCounts };
