// The deterministic scheduling-rules resolver. Pure functions (no DB, no server-only)
// so it's exhaustively unit-testable and safe to import anywhere. Given a person's
// active rules + the existing shifts in a window, it returns:
//   • proposals — concrete candidate shifts the scheduler can ACCEPT (reusing the
//     same propose → engine-validate → confirm pattern as Ask AI). Rules NEVER
//     auto-commit; a proposal becomes a real shift only when a human accepts it.
//   • unmet — advisory warnings for rules that can't be turned into a single
//     unambiguous shift (quotas, quarterly project days, day-specific work-type
//     reminders, and "don't assign" violations). The builder shows these as soft,
//     dismissible flags.
//
// params conventions are defined in lib/scheduling-rules-display.ts.

import { eachDate } from "@/lib/dates";
import { describeRule } from "@/lib/scheduling-rules-display";
import type { SchedulingRuleType, StaffSchedulingRule } from "@/lib/types";

export interface RuleProposal {
  rule_id: string;
  staff_id: string;
  date: string; // yyyy-mm-dd
  start_time: string; // "HH:MM"
  end_time: string; // "HH:MM"
  work_type_id: string | null;
  location_id: string | null;
  rule_type: SchedulingRuleType;
  label: string; // human summary of the rule that produced this
}

export interface UnmetRule {
  rule_id: string;
  staff_id: string;
  rule_type: SchedulingRuleType;
  message: string;
}

/** One existing shift fact the resolver needs (any status), with its work types. */
export interface ExistingShift {
  staff_id: string;
  date: string;
  work_type_ids: string[];
}

export interface ResolveContext {
  windowStart: string;
  windowEnd: string;
  rules: StaffSchedulingRule[];
  existingShifts: ExistingShift[];
  /** `${staff_id}|${date}` for every day a person is off (PTO / approved TOR). */
  offCells: Set<string>;
  /** staff_id → home location id (fallback when a rule names no location). */
  staffHomeLocation: Map<string, string | null>;
  workTypeName: (id: string) => string | undefined;
}

// ── date helpers (UTC-anchored, mirror lib/dates) ──────────────────────────────
function dow(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}
function iso(year: number, month0: number, day: number): string {
  return `${year}-${String(month0 + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
function daysBetween(a: string, b: string): number {
  return Math.round(
    (Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86400000
  );
}
function daysInMonth(year: number, month0: number): number {
  return new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate();
}

/** Date of the nth (1–4) or last (5) `weekday` in a month, or null if none. */
export function nthWeekdayOfMonth(
  year: number,
  month0: number,
  weekday: number,
  occurrence: number
): string | null {
  if (occurrence >= 5) {
    const last = daysInMonth(year, month0);
    const lastDow = new Date(Date.UTC(year, month0, last)).getUTCDay();
    const diff = (lastDow - weekday + 7) % 7;
    return iso(year, month0, last - diff);
  }
  const firstDow = new Date(Date.UTC(year, month0, 1)).getUTCDay();
  const offset = (weekday - firstDow + 7) % 7;
  const day = 1 + offset + (occurrence - 1) * 7;
  if (day > daysInMonth(year, month0)) return null;
  return iso(year, month0, day);
}

/** Distinct (year, month0) pairs touched by the window. */
function monthsInWindow(start: string, end: string): { year: number; month0: number }[] {
  const out: { year: number; month0: number }[] = [];
  let y = Number(start.slice(0, 4));
  let m = Number(start.slice(5, 7)) - 1;
  const endY = Number(end.slice(0, 4));
  const endM = Number(end.slice(5, 7)) - 1;
  while (y < endY || (y === endY && m <= endM)) {
    out.push({ year: y, month0: m });
    m += 1;
    if (m > 11) { m = 0; y += 1; }
  }
  return out;
}

/** The dates in the LAST calendar week (final 7 days) of a month. */
function lastWeekDates(year: number, month0: number): string[] {
  const dim = daysInMonth(year, month0);
  const out: string[] = [];
  for (let d = Math.max(1, dim - 6); d <= dim; d++) out.push(iso(year, month0, d));
  return out;
}

// ── resolver ───────────────────────────────────────────────────────────────────
const DEFAULT_START = "08:00";
const DEFAULT_END = "17:00";

export function resolveScheduleRules(ctx: ResolveContext): {
  proposals: RuleProposal[];
  unmet: UnmetRule[];
} {
  const proposals: RuleProposal[] = [];
  const unmet: UnmetRule[] = [];

  // Index existing shifts: a day a person already works, and their work types per day.
  const worksOn = new Set<string>(); // `${staff}|${date}`
  const wtByCell = new Map<string, Set<string>>(); // `${staff}|${date}` → wt ids
  for (const s of ctx.existingShifts) {
    const key = `${s.staff_id}|${s.date}`;
    worksOn.add(key);
    const set = wtByCell.get(key) ?? new Set<string>();
    for (const id of s.work_type_ids) set.add(id);
    wtByCell.set(key, set);
  }
  const isFree = (staff: string, date: string) =>
    !worksOn.has(`${staff}|${date}`) && !ctx.offCells.has(`${staff}|${date}`);

  const windowDates = eachDate(ctx.windowStart, ctx.windowEnd);
  const lookup = (id: string) => ctx.workTypeName(id);

  for (const rule of ctx.rules) {
    if (!rule.is_active) continue;
    const label = describeRule(rule, { workTypeName: lookup });
    const locId = rule.location_id ?? ctx.staffHomeLocation.get(rule.staff_id) ?? null;
    const p = (rule.params ?? {}) as Record<string, unknown>;
    const days = Array.isArray(p.days) ? (p.days as number[]) : [];
    const start = (p.start_time as string) || DEFAULT_START;
    const end = (p.end_time as string) || DEFAULT_END;
    const anchor = (p.anchor_date as string) || null;

    const everyOtherWeekOn = (date: string): boolean => {
      if (rule.frequency !== "every_other_week") return true;
      if (!anchor) return true; // no anchor → treat as weekly
      return Math.floor(daysBetween(anchor, date) / 7) % 2 === 0;
    };

    switch (rule.rule_type) {
      case "recurring_shift":
      case "recurring_work_type_assignment": {
        if (days.length === 0) break;
        for (const date of windowDates) {
          if (!days.includes(dow(date))) continue;
          if (!everyOtherWeekOn(date)) continue;
          if (!isFree(rule.staff_id, date)) continue;
          proposals.push({
            rule_id: rule.id,
            staff_id: rule.staff_id,
            date,
            start_time: start,
            end_time: end,
            work_type_id: rule.work_type_id,
            location_id: locId,
            rule_type: rule.rule_type,
            label,
          });
        }
        break;
      }

      case "nth_weekday_assignment": {
        const occ = Number(p.week_occurrence) || 1;
        const wd = Number(p.day_of_week ?? 4);
        const dur = Number(p.duration_hours) || 0;
        const st = (p.start_time as string) || "12:00";
        const en = dur ? addHours(st, dur) : (p.end_time as string) || "13:00";
        for (const { year, month0 } of monthsInWindow(ctx.windowStart, ctx.windowEnd)) {
          const date = nthWeekdayOfMonth(year, month0, wd, occ);
          if (!date || date < ctx.windowStart || date > ctx.windowEnd) continue;
          // already has this work type that day → satisfied
          const has = rule.work_type_id
            ? wtByCell.get(`${rule.staff_id}|${date}`)?.has(rule.work_type_id)
            : worksOn.has(`${rule.staff_id}|${date}`);
          if (has) continue;
          if (ctx.offCells.has(`${rule.staff_id}|${date}`)) continue;
          // Only propose a fresh shift on a free day; if they already work that day,
          // surface it as a reminder instead of double-booking.
          if (isFree(rule.staff_id, date)) {
            proposals.push({
              rule_id: rule.id,
              staff_id: rule.staff_id,
              date,
              start_time: st,
              end_time: en,
              work_type_id: rule.work_type_id,
              location_id: locId,
              rule_type: rule.rule_type,
              label,
            });
          } else {
            unmet.push({
              rule_id: rule.id,
              staff_id: rule.staff_id,
              rule_type: rule.rule_type,
              message: `${label} — they already work ${date}; set that shift's work type.`,
            });
          }
        }
        break;
      }

      case "monthly_quota": {
        const quota = Number(p.quota_per_period) || 1;
        for (const { year, month0 } of monthsInWindow(ctx.windowStart, ctx.windowEnd)) {
          const prefix = `${year}-${String(month0 + 1).padStart(2, "0")}`;
          let count = 0;
          for (const s of ctx.existingShifts) {
            if (s.staff_id !== rule.staff_id) continue;
            if (!s.date.startsWith(prefix)) continue;
            if (rule.work_type_id ? s.work_type_ids.includes(rule.work_type_id) : true)
              count += 1;
          }
          if (count < quota) {
            unmet.push({
              rule_id: rule.id,
              staff_id: rule.staff_id,
              rule_type: rule.rule_type,
              message: `${label} — ${count}/${quota} scheduled in ${prefix}.`,
            });
          }
        }
        break;
      }

      case "quarterly_project_days": {
        const months = Array.isArray(p.month_occurrence)
          ? (p.month_occurrence as number[])
          : [];
        const quota = Number(p.quota_per_period) || 1;
        for (const { year, month0 } of monthsInWindow(ctx.windowStart, ctx.windowEnd)) {
          if (!months.includes(month0 + 1)) continue;
          const week = new Set(lastWeekDates(year, month0));
          // only warn once the window actually reaches that last week
          if (![...week].some((d) => d >= ctx.windowStart && d <= ctx.windowEnd))
            continue;
          let count = 0;
          for (const s of ctx.existingShifts) {
            if (s.staff_id !== rule.staff_id || !week.has(s.date)) continue;
            if (rule.work_type_id ? s.work_type_ids.includes(rule.work_type_id) : true)
              count += 1;
          }
          if (count < quota) {
            unmet.push({
              rule_id: rule.id,
              staff_id: rule.staff_id,
              rule_type: rule.rule_type,
              message: `${label} — ${count}/${quota} in the last week of ${iso(year, month0, 1).slice(0, 7)}.`,
            });
          }
        }
        break;
      }

      case "preferred_work_type_by_day": {
        // Advisory: on these weekdays, this person should be assigned the work type.
        for (const date of windowDates) {
          if (!days.includes(dow(date))) continue;
          const cell = `${rule.staff_id}|${date}`;
          if (ctx.offCells.has(cell)) continue;
          const hasWt = rule.work_type_id
            ? wtByCell.get(cell)?.has(rule.work_type_id)
            : worksOn.has(cell);
          if (!hasWt) {
            unmet.push({
              rule_id: rule.id,
              staff_id: rule.staff_id,
              rule_type: rule.rule_type,
              message: `${label} (${date}).`,
            });
          }
        }
        break;
      }

      case "preferred_not_assigned": {
        // Warn if the person IS assigned the avoided work type anywhere in the window.
        if (!rule.work_type_id) break;
        for (const date of windowDates) {
          if (wtByCell.get(`${rule.staff_id}|${date}`)?.has(rule.work_type_id)) {
            unmet.push({
              rule_id: rule.id,
              staff_id: rule.staff_id,
              rule_type: rule.rule_type,
              message: `${label} — assigned ${date}.`,
            });
          }
        }
        break;
      }

      // preferred_shift_length, preferred_days, float_location,
      // per_diem_availability: pure context — shown on the record/tooltip, not
      // surfaced as proposals or warnings here.
      default:
        break;
    }
  }

  return { proposals, unmet };
}

/** "07:30" + 1.5h → "09:00". Caps at 23:59 (no overnight for nth-weekday blocks). */
function addHours(time: string, hours: number): string {
  const [h, m] = time.split(":").map(Number);
  const total = Math.min(23 * 60 + 59, h * 60 + (m || 0) + Math.round(hours * 60));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/** Group proposals by staff for the period-level "Apply rules" UI. */
export function groupProposalsByStaff(
  proposals: RuleProposal[]
): Map<string, RuleProposal[]> {
  const map = new Map<string, RuleProposal[]>();
  for (const pr of proposals) {
    const list = map.get(pr.staff_id) ?? [];
    list.push(pr);
    map.set(pr.staff_id, list);
  }
  return map;
}
