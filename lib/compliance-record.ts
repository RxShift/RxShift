// The Compliance Record (as-worked) finalizer.
//
// Reconstructs, per location per completed hour, who was ACTUALLY on and
// counting — the published shift adjusted by the live-status history (a
// non-counting status removes that person for the minutes it covered) — runs
// the SAME deterministic ratio engine the rest of the app uses, and writes an
// IMMUTABLE compliance_record row. Once an hour is recorded it is never
// recomputed (later schedule edits don't rewrite history; a manager adds a note
// instead). Idempotent: only fills hours not yet recorded.
//
// Deliberately has NO "server-only" import and takes a SupabaseClient — so it
// runs from the finalize cron (service role) AND from the tsx demo seed, exactly
// like lib/engine/* and lib/demo/mesa-vista.ts.

import type { SupabaseClient } from "@supabase/supabase-js";
import { evaluateZone, timeToMinutes, minutesToTime } from "./engine/ratio";
import { buildEngineRule } from "./engine/rule";
import { generateComplianceRecord } from "./engine/compliance";
import type { EngineSegment } from "./engine/types";
import { countsByStatus } from "./live-status-config";
import {
  addDaysStr,
  dateInTimeZone,
  minutesInTimeZone,
  nowInTimeZone,
} from "./dates";
import type {
  ComplianceRecordRow,
  CountsAs,
  LiveStatus,
  LiveStatusConfig,
  RatioRule,
  RatioType,
  Tenant,
} from "./types";

export interface FinalizeOptions {
  /** Inclusive date range (tenant tz, yyyy-mm-dd). Defaults to a lookback. */
  from?: string;
  to?: string;
  /** How far back to finalize when `from` is omitted (default 3 days). */
  lookbackDays?: number;
  /** Treat "now" as this point (tenant tz). Defaults to the real wall clock.
   *  The demo seed passes end-of-day so the current week is fully recorded. */
  asOf?: { date: string; minutes: number };
}

interface ShiftRow {
  id: string;
  location_id: string;
  staff_id: string;
  date: string;
  status: string;
  shift_segment: {
    start_time: string;
    end_time: string;
    work_type_id: string | null;
    counts_toward_ratio: boolean | null;
  }[];
}

type NonCountingWindow = { start: number; end: number };

/** Non-counting windows (local minutes on `date`) for one staff member's
 *  live-status history. A counting status leaves presence as scheduled.
 *  Exported for tests. */
export function nonCountingWindows(
  rows: LiveStatus[],
  date: string,
  tz: string,
  countsCfg: Record<string, boolean>,
  asOf: { date: string; minutes: number }
): NonCountingWindow[] {
  const out: NonCountingWindow[] = [];
  for (const r of rows) {
    if (countsCfg[r.status] !== false) continue; // counting status → no removal
    const fromDate = dateInTimeZone(r.effective_from, tz);
    if (fromDate > date) continue;
    const toDate = r.effective_to ? dateInTimeZone(r.effective_to, tz) : null;
    if (toDate !== null && toDate < date) continue;

    const start = fromDate < date ? 0 : minutesInTimeZone(r.effective_from, tz);
    let end: number;
    if (r.effective_to === null) {
      // Open status: in effect until "now" on its own day, else the full day.
      end = date < asOf.date ? 1440 : date === asOf.date ? asOf.minutes : 1440;
    } else {
      end = toDate! > date ? 1440 : minutesInTimeZone(r.effective_to, tz);
    }
    if (end > start) out.push({ start, end });
  }
  return out;
}

/** Split a same-day segment so the minutes inside a non-counting window are
 *  forced not-counting (counts_override=false); the rest keep their scheduled
 *  counting. Midnight-crossing segments pass through unchanged (rare for retail
 *  hours; the live overlay for overnight shifts is a documented v1 limitation).
 *  Exported for tests. */
export function splitByWindows(
  seg: EngineSegment,
  windows: NonCountingWindow[]
): EngineSegment[] {
  const s = timeToMinutes(seg.start_time);
  const e = timeToMinutes(seg.end_time);
  if (windows.length === 0 || e <= s) return [seg];

  const points = new Set<number>([s, e]);
  for (const w of windows) {
    if (w.start > s && w.start < e) points.add(w.start);
    if (w.end > s && w.end < e) points.add(w.end);
  }
  const sorted = [...points].sort((a, b) => a - b);
  const out: EngineSegment[] = [];
  for (let i = 0; i < sorted.length - 1; i++) {
    const a = sorted[i];
    const b = sorted[i + 1];
    const mid = (a + b) / 2;
    const inWindow = windows.some((w) => mid >= w.start && mid < w.end);
    out.push({
      ...seg,
      start_time: minutesToTime(a),
      end_time: minutesToTime(b),
      counts_override: inWindow ? false : seg.counts_override,
    });
  }
  return out;
}

/** True once the (date, hour) is fully in the past relative to asOf. */
function hourComplete(
  date: string,
  hour: number,
  asOf: { date: string; minutes: number }
): boolean {
  if (date < asOf.date) return true;
  if (date > asOf.date) return false;
  return (hour + 1) * 60 <= asOf.minutes;
}

export interface FinalizeResult {
  tenantId: string;
  recorded: number;
  hoursConsidered: number;
}

/**
 * Finalize the Compliance Record for one tenant over a date range. Reuses the
 * deterministic engine; writes immutable rows for completed, not-yet-recorded
 * hours. Returns how many rows were newly written.
 */
export async function finalizeComplianceForTenant(
  service: SupabaseClient,
  tenant: Tenant,
  opts: FinalizeOptions = {}
): Promise<FinalizeResult> {
  if (!tenant.has_ratio) return { tenantId: tenant.id, recorded: 0, hoursConsidered: 0 };

  const tz = tenant.timezone;
  const asOf = opts.asOf ?? nowInTimeZone(tz);
  const to = opts.to ?? asOf.date;
  const from = opts.from ?? addDaysStr(asOf.date, -(opts.lookbackDays ?? 3));

  const [
    { data: ruleRows },
    { data: staffRows },
    { data: workTypeRows },
    { data: locationRows },
    { data: cfgRows },
    { data: shiftRows },
    { data: liveRows },
    { data: calloutRows },
  ] = await Promise.all([
    service.from("ratio_rule").select("*").eq("tenant_id", tenant.id),
    service.from("staff").select("id, full_name, ratio_type, staff_type, certified, excluded_from_ratio").eq("tenant_id", tenant.id),
    service.from("work_type").select("id, name, counts_as, counting_default").eq("tenant_id", tenant.id),
    service.from("location").select("id, name, location_type, has_drive_through").eq("tenant_id", tenant.id),
    service.from("live_status_config").select("*").eq("tenant_id", tenant.id),
    service
      .from("shift")
      .select("id, location_id, staff_id, date, status, shift_segment(start_time, end_time, work_type_id, counts_toward_ratio)")
      .eq("tenant_id", tenant.id)
      .eq("status", "published")
      .gte("date", from)
      .lte("date", to),
    service
      .from("live_status")
      .select("*")
      .eq("tenant_id", tenant.id)
      .lte("effective_from", `${addDaysStr(to, 1)}T00:00:00Z`),
    // Active (non-reversed) call-outs in range → the person was absent that day.
    // The daily cron finalizes after the day is over, so a same-day mistake that
    // gets reversed nets out (no longer active) before the record is written.
    service
      .from("callout")
      .select("staff_id, callout_date")
      .eq("tenant_id", tenant.id)
      .is("reversed_at", null)
      .gte("callout_date", from)
      .lte("callout_date", to),
  ]);

  const calledOut = new Set(
    ((calloutRows ?? []) as { staff_id: string; callout_date: string | null }[])
      .filter((c) => c.callout_date)
      .map((c) => `${c.staff_id}|${c.callout_date}`)
  );

  const rule = ((ruleRows ?? []) as RatioRule[]).find((r) => r.tenant_id !== null);
  if (!rule) return { tenantId: tenant.id, recorded: 0, hoursConsidered: 0 };

  const staffById = new Map(
    ((staffRows ?? []) as {
      id: string;
      full_name: string;
      ratio_type: string;
      staff_type: string;
      certified: boolean;
      excluded_from_ratio: boolean;
    }[]).map((s) => [s.id, s])
  );
  const wtById = new Map(
    ((workTypeRows ?? []) as {
      id: string;
      name: string;
      counts_as: string;
      counting_default: boolean;
    }[]).map((w) => [w.id, w])
  );
  type LocRow = {
    id: string;
    name: string;
    location_type: "retail" | "telepharmacy" | "institutional";
    has_drive_through: boolean;
  };
  const locById = new Map(
    ((locationRows ?? []) as LocRow[]).map((l) => [l.id, l])
  );
  const locName = new Map(
    ((locationRows ?? []) as LocRow[]).map((l) => [l.id, l.name])
  );
  const countsCfg = countsByStatus((cfgRows ?? []) as LiveStatusConfig[]);
  const liveByStaff = new Map<string, LiveStatus[]>();
  for (const r of (liveRows ?? []) as LiveStatus[]) {
    const list = liveByStaff.get(r.staff_id) ?? [];
    list.push(r);
    liveByStaff.set(r.staff_id, list);
  }

  // Build the ACTUAL-presence segments per location, splitting each scheduled
  // segment by its staff member's non-counting windows on that date.
  const byLocation = new Map<string, EngineSegment[]>();
  for (const sh of (shiftRows ?? []) as ShiftRow[]) {
    const person = staffById.get(sh.staff_id);
    if (!person) continue;
    // A called-out person wasn't there — drop their shift from the as-worked
    // reconstruction so the record reflects the true (possibly deficient) gap.
    if (calledOut.has(`${sh.staff_id}|${sh.date}`)) continue;
    const windows = nonCountingWindows(
      liveByStaff.get(sh.staff_id) ?? [],
      sh.date,
      tz,
      countsCfg,
      asOf
    );
    const list = byLocation.get(sh.location_id) ?? [];
    for (const seg of sh.shift_segment ?? []) {
      const wt = seg.work_type_id ? wtById.get(seg.work_type_id) : null;
      const base: EngineSegment = {
        shift_id: sh.id,
        location_id: sh.location_id,
        date: sh.date,
        start_time: String(seg.start_time).slice(0, 5),
        end_time: String(seg.end_time).slice(0, 5),
        staff: {
          id: person.id,
          full_name: person.full_name,
          ratio_type: person.ratio_type as RatioType,
          is_trainee: person.staff_type === "tech_in_training",
          certified: person.certified,
          excluded_from_ratio: person.excluded_from_ratio,
        },
        work_type: wt
          ? {
              id: wt.id,
              name: wt.name,
              counts_as: wt.counts_as as CountsAs,
              counting_default: wt.counting_default,
            }
          : null,
        counts_override: seg.counts_toward_ratio,
      };
      list.push(...splitByWindows(base, windows));
    }
    byLocation.set(sh.location_id, list);
  }

  // Evaluate each location and collect the completed, not-yet-recorded hours.
  const candidate: ComplianceRecordRow[] = [];
  for (const [locationId, segs] of byLocation) {
    const loc = locById.get(locationId);
    const engineRule = buildEngineRule(rule, {
      locationType: loc?.location_type,
      hasDriveThrough: loc?.has_drive_through,
      r072Enabled: tenant.nevada_r072_25,
    });
    const evals = evaluateZone(segs, engineRule, tenant.ratio_slot_minutes);
    const rows = generateComplianceRecord(
      evals,
      locationId,
      locName.get(locationId) ?? "Location"
    );
    for (const row of rows) {
      if (row.date < from || row.date > to) continue;
      if (!hourComplete(row.date, row.hour, asOf)) continue;
      candidate.push(row);
    }
  }
  if (candidate.length === 0)
    return { tenantId: tenant.id, recorded: 0, hoursConsidered: 0 };

  // Idempotent: skip hours already recorded (immutable — never overwrite).
  const { data: existing } = await service
    .from("compliance_record")
    .select("location_id, date, hour")
    .eq("tenant_id", tenant.id)
    .gte("date", from)
    .lte("date", to);
  const seen = new Set(
    ((existing ?? []) as { location_id: string; date: string; hour: number }[]).map(
      (r) => `${r.location_id}|${r.date}|${r.hour}`
    )
  );

  const toInsert = candidate
    .filter((r) => !seen.has(`${r.location_id}|${r.date}|${r.hour}`))
    .map((r) => ({
      tenant_id: tenant.id,
      location_id: r.location_id,
      date: r.date,
      hour: r.hour,
      ratio_status: r.ratio_status,
      deficiency_reason: r.deficiency_reason,
      flag_type: r.flag_type ?? null,
      required_max_techs: rule.max_techs_per_pharmacist,
      detail: r,
    }));

  if (toInsert.length > 0) {
    // ignoreDuplicates guards a race with a concurrent run; we never overwrite.
    const { error } = await service
      .from("compliance_record")
      .upsert(toInsert, {
        onConflict: "tenant_id,location_id,date,hour",
        ignoreDuplicates: true,
      });
    if (error) throw new Error(`compliance_record upsert: ${error.message}`);
  }

  return {
    tenantId: tenant.id,
    recorded: toInsert.length,
    hoursConsidered: candidate.length,
  };
}

/** Finalize every ratio tenant (the cron entry point). */
export async function finalizeAllTenants(
  service: SupabaseClient,
  opts: FinalizeOptions = {}
): Promise<FinalizeResult[]> {
  const { data: tenants } = await service
    .from("tenant")
    .select("*")
    .eq("has_ratio", true);
  const results: FinalizeResult[] = [];
  for (const t of (tenants ?? []) as Tenant[]) {
    results.push(await finalizeComplianceForTenant(service, t, opts));
  }
  return results;
}
