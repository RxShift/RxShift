// Constraint rules engine — Appendix C. All advisory: produces flags,
// never blocks. Each rule has an effective date range and applies to a
// staff member or to a whole role (ratio_type).

import type { ConstraintRule, RatioType } from "@/lib/types";
import type { ConstraintFlag, EngineSegment } from "./types";
import { addDays, timeToMinutes } from "./ratio";

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

function dayMatches(date: string, days: unknown): boolean {
  if (!Array.isArray(days)) return false;
  const wd = weekday(date);
  return days.some(
    (d) =>
      d === wd ||
      (typeof d === "string" && d.toLowerCase().slice(0, 3) === DAY_NAMES[wd])
  );
}

function segmentHours(seg: EngineSegment): number {
  const start = timeToMinutes(seg.start_time);
  const end = timeToMinutes(seg.end_time);
  const mins = end > start ? end - start : 1440 - start + end;
  return mins / 60;
}

/** Monday of the ISO week containing the date. */
function weekStart(date: string): string {
  const wd = weekday(date);
  return addDays(date, wd === 0 ? -6 : 1 - wd);
}

function ruleActiveOn(rule: ConstraintRule, date: string): boolean {
  if (!rule.active) return false;
  if (rule.effective_start && date < rule.effective_start) return false;
  if (rule.effective_end && date > rule.effective_end) return false;
  return true;
}

function ruleAppliesTo(
  rule: ConstraintRule,
  staffId: string,
  ratioType: RatioType
): boolean {
  if (rule.scope_type === "staff") return rule.scope_id === staffId;
  return rule.scope_id === ratioType;
}

/**
 * Evaluate all constraint rules against a set of segments (typically one
 * schedule period, but callers may pass surrounding periods for accurate
 * weekly/yearly totals).
 */
export function evaluateConstraints(
  rules: ConstraintRule[],
  segments: EngineSegment[]
): ConstraintFlag[] {
  const flags: ConstraintFlag[] = [];

  // Group hours by staff for the aggregate rules
  const byStaff = new Map<string, EngineSegment[]>();
  for (const seg of segments) {
    const list = byStaff.get(seg.staff.id) ?? [];
    list.push(seg);
    byStaff.set(seg.staff.id, list);
  }

  for (const rule of rules) {
    for (const [staffId, segs] of byStaff) {
      const sample = segs[0];
      if (!ruleAppliesTo(rule, staffId, sample.staff.ratio_type)) continue;
      const applicable = segs.filter((s) => ruleActiveOn(rule, s.date));
      if (applicable.length === 0) continue;
      const staffName = sample.staff.full_name;

      switch (rule.rule_type) {
        case "hour_cap": {
          const cap = Number(rule.params.hours ?? 0);
          const period = String(rule.params.period ?? "week");
          const buckets = new Map<string, number>();
          // Unpaid break is a per-SHIFT value carried on each segment —
          // subtract it once per shift, not once per segment.
          const breakTaken = new Set<string>();
          for (const s of applicable) {
            const key =
              period === "year"
                ? s.date.slice(0, 4)
                : period === "pay_period"
                  ? weekStart(s.date) // approximation: weekly buckets
                  : weekStart(s.date);
            let hours = segmentHours(s);
            if (!breakTaken.has(s.shift_id)) {
              breakTaken.add(s.shift_id);
              hours -= (s.break_minutes ?? 0) / 60;
            }
            buckets.set(key, (buckets.get(key) ?? 0) + hours);
          }
          for (const [bucket, hours] of buckets) {
            if (hours > cap) {
              flags.push({
                rule_id: rule.id,
                rule_type: rule.rule_type,
                staff_id: staffId,
                staff_name: staffName,
                shift_id: null,
                date: bucket.length === 4 ? null : bucket,
                message: `${staffName} is scheduled ${hours.toFixed(1)} hours in the ${period} ${bucket.length === 4 ? bucket : `starting ${bucket}`} — cap is ${cap}`,
              });
            }
          }
          break;
        }

        case "overtime": {
          const threshold = Number(rule.params.threshold_hours ?? 40);
          const weeks = new Map<string, number>();
          const breakTaken = new Set<string>();
          for (const s of applicable) {
            const wk = weekStart(s.date);
            let hours = segmentHours(s);
            if (!breakTaken.has(s.shift_id)) {
              breakTaken.add(s.shift_id);
              hours -= (s.break_minutes ?? 0) / 60;
            }
            weeks.set(wk, (weeks.get(wk) ?? 0) + hours);
          }
          for (const [wk, hours] of weeks) {
            if (hours > threshold) {
              flags.push({
                rule_id: rule.id,
                rule_type: rule.rule_type,
                staff_id: staffId,
                staff_name: staffName,
                shift_id: null,
                date: wk,
                message: `${staffName} is at ${hours.toFixed(1)} hours the week of ${wk} — over the ${threshold}-hour overtime threshold`,
              });
            }
          }
          break;
        }

        case "unavailable_window": {
          const range = rule.params.time_range as
            | { start: string; end: string }
            | undefined;
          for (const s of applicable) {
            if (!dayMatches(s.date, rule.params.days)) continue;
            if (range) {
              const rStart = timeToMinutes(range.start);
              const rEnd = timeToMinutes(range.end);
              const sStart = timeToMinutes(s.start_time);
              const sEnd0 = timeToMinutes(s.end_time);
              const sEnd = sEnd0 > sStart ? sEnd0 : 1440;
              if (sStart >= rEnd || sEnd <= rStart) continue;
            }
            flags.push({
              rule_id: rule.id,
              rule_type: rule.rule_type,
              staff_id: staffId,
              staff_name: staffName,
              shift_id: s.shift_id,
              date: s.date,
              message: `${staffName} is unavailable ${range ? `${range.start}–${range.end}` : "that day"} on ${s.date} but is scheduled ${s.start_time}–${s.end_time}`,
            });
          }
          break;
        }

        case "hard_stop": {
          const stop = timeToMinutes(String(rule.params.time ?? "23:59"));
          for (const s of applicable) {
            if (
              rule.params.days !== undefined &&
              !dayMatches(s.date, rule.params.days)
            )
              continue;
            const sStart = timeToMinutes(s.start_time);
            const sEnd0 = timeToMinutes(s.end_time);
            const crossesMidnight = sEnd0 <= sStart;
            if (crossesMidnight || sEnd0 > stop) {
              flags.push({
                rule_id: rule.id,
                rule_type: rule.rule_type,
                staff_id: staffId,
                staff_name: staffName,
                shift_id: s.shift_id,
                date: s.date,
                message: `${staffName} cannot work past ${rule.params.time} on ${s.date} but is scheduled until ${s.end_time}`,
              });
            }
          }
          break;
        }

        case "recurring_unavailable": {
          const rec = rule.params.recurrence as
            | { days?: unknown; interval_weeks?: number; anchor_date?: string }
            | undefined;
          if (!rec) break;
          const interval = Math.max(1, Number(rec.interval_weeks ?? 1));
          const anchor = rec.anchor_date
            ? weekStart(rec.anchor_date)
            : null;
          for (const s of applicable) {
            if (rec.days !== undefined && !dayMatches(s.date, rec.days))
              continue;
            if (anchor && interval > 1) {
              const diffDays = Math.round(
                (Date.parse(`${weekStart(s.date)}T00:00:00Z`) -
                  Date.parse(`${anchor}T00:00:00Z`)) /
                  86400000
              );
              const weeksSince = Math.floor(diffDays / 7);
              if (((weeksSince % interval) + interval) % interval !== 0)
                continue;
            }
            flags.push({
              rule_id: rule.id,
              rule_type: rule.rule_type,
              staff_id: staffId,
              staff_name: staffName,
              shift_id: s.shift_id,
              date: s.date,
              message: `${staffName} has a recurring unavailability on ${s.date}`,
            });
          }
          break;
        }

        case "always_off": {
          for (const s of applicable) {
            if (!dayMatches(s.date, rule.params.days)) continue;
            flags.push({
              rule_id: rule.id,
              rule_type: rule.rule_type,
              staff_id: staffId,
              staff_name: staffName,
              shift_id: s.shift_id,
              date: s.date,
              message: `${staffName} is always off on that day of the week but is scheduled on ${s.date}`,
            });
          }
          break;
        }

        case "max_consecutive_days": {
          const max = Number(rule.params.max_days ?? 6);
          const dates = [...new Set(applicable.map((s) => s.date))].sort();
          let streakStart = 0;
          for (let i = 1; i <= dates.length; i++) {
            const broke =
              i === dates.length || dates[i] !== addDays(dates[i - 1], 1);
            if (broke) {
              const len = i - streakStart;
              if (len > max) {
                flags.push({
                  rule_id: rule.id,
                  rule_type: rule.rule_type,
                  staff_id: staffId,
                  staff_name: staffName,
                  shift_id: null,
                  date: dates[streakStart],
                  message: `${staffName} is scheduled ${len} consecutive days starting ${dates[streakStart]} — limit is ${max}`,
                });
              }
              streakStart = i;
            }
          }
          break;
        }
      }
    }
  }

  return flags;
}
