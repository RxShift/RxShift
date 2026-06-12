import "server-only";
import { createClient } from "@/lib/supabase/server";
import { evaluateZone, minutesToTime, segmentCounts } from "@/lib/engine/ratio";
import { evaluateConstraints } from "@/lib/engine/constraints";
import {
  generateComplianceRecord,
  deficiencyStreaks,
} from "@/lib/engine/compliance";
import type {
  ComplianceRecordRow,
  ConstraintRule,
  RatioRule,
  RatioZone,
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
  zones: RatioZone[];
  ratioRule: RatioRule | null;
  constraints: ConstraintRule[];
  approvedTimeOff: TimeOffRequest[];
}

export interface RatioFlagOut {
  zone_id: string;
  zone_name: string;
  date: string;
  slot_label: string; // "14:00–14:30"
  reason: string;
}

export interface ValidationOut {
  ratioFlags: RatioFlagOut[];
  constraintFlags: ConstraintFlag[];
  /** dates (per zone) that contain at least one deficient slot */
  deficientCells: { [zoneId: string]: string[] };
}

export async function loadPeriodBundle(
  periodId: string
): Promise<PeriodBundle | null> {
  const supabase = await createClient();

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
    { data: zones },
    { data: rules },
    { data: constraints },
    { data: timeOff },
  ] = await Promise.all([
    supabase.from("shift").select("*").eq("schedule_period_id", periodId),
    supabase
      .from("shift_segment")
      .select("*, shift!inner(schedule_period_id)")
      .eq("shift.schedule_period_id", periodId),
    supabase.from("staff").select("*").order("full_name"),
    supabase.from("work_type").select("*").order("name"),
    supabase
      .from("ratio_zone")
      .select("*")
      .eq("location_id", period.location_id),
    supabase.from("ratio_rule").select("*"),
    supabase.from("constraint_rule").select("*").eq("active", true),
    supabase
      .from("time_off_request")
      .select("*")
      .eq("status", "approved")
      .lte("start_date", period.end_date)
      .gte("end_date", period.start_date),
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
    zones: (zones ?? []) as RatioZone[],
    ratioRule: tenantRule,
    constraints: (constraints ?? []) as ConstraintRule[],
    approvedTimeOff: (timeOff ?? []) as TimeOffRequest[],
  };
}

/** Full rule subset for the engine — keeps additive-formula fields intact. */
export function toEngineRule(rule: RatioRule) {
  return {
    max_techs_per_pharmacist: rule.max_techs_per_pharmacist,
    formula: rule.formula,
    additive_first_techs: rule.additive_first_techs,
    additive_additional_techs: rule.additive_additional_techs,
  };
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
        zone_id: shift.ratio_zone_id,
        date: shift.date,
        break_minutes: shift.break_minutes ?? 0,
        start_time: String(seg.start_time).slice(0, 5),
        end_time: String(seg.end_time).slice(0, 5),
        staff: {
          id: person.id,
          full_name: person.full_name,
          ratio_type: person.ratio_type,
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
  const deficientCells: { [zoneId: string]: string[] } = {};

  if (tenant.has_ratio && bundle.ratioRule) {
    for (const zone of bundle.zones) {
      const zoneSegs = segments.filter((s) => s.zone_id === zone.id);
      if (zoneSegs.length === 0) continue;
      const evals = evaluateZone(
        zoneSegs,
        toEngineRule(bundle.ratioRule),
        tenant.ratio_slot_minutes
      );
      for (const [date, slots] of evals) {
        for (const slot of slots) {
          if (slot.status === "deficient") {
            ratioFlags.push({
              zone_id: zone.id,
              zone_name: zone.name,
              date,
              slot_label: `${minutesToTime(slot.slot_start)}–${minutesToTime(slot.slot_start + slot.slot_minutes)}`,
              reason: slot.deficiency_reason ?? "deficient",
            });
            const cells = deficientCells[zone.id] ?? [];
            if (!cells.includes(date)) cells.push(date);
            deficientCells[zone.id] = cells;
          }
        }
      }
    }
  }

  const constraintFlags = evaluateConstraints(bundle.constraints, segments);

  return { ratioFlags, constraintFlags, deficientCells };
}

/** Generate compliance record rows for every zone in a period. */
export function buildComplianceRecords(
  bundle: PeriodBundle,
  tenant: Tenant
): { zone: RatioZone; rows: ComplianceRecordRow[] }[] {
  if (!bundle.ratioRule) return [];
  const segments = toEngineSegments(bundle);
  const out: { zone: RatioZone; rows: ComplianceRecordRow[] }[] = [];

  for (const zone of bundle.zones) {
    const zoneSegs = segments.filter((s) => s.zone_id === zone.id);
    if (zoneSegs.length === 0) continue;
    const evals = evaluateZone(
      zoneSegs,
      toEngineRule(bundle.ratioRule),
      tenant.ratio_slot_minutes
    );
    out.push({
      zone,
      rows: generateComplianceRecord(evals, zone.id, zone.name),
    });
  }
  return out;
}

export { deficiencyStreaks, segmentCounts };
