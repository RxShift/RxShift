// Plain-language rendering for scheduling rules + the canonical params conventions.
// The form (rule-form.tsx), the resolver (engine/scheduling-rules.ts), and every
// display surface (staff record, builder tooltip, proposals) read params the SAME
// way — defined here so they can't drift.
//
// params conventions by rule_type (all days are 0=Sun … 6=Sat):
//   recurring_shift                 days:number[], start_time, end_time  (+ optional frequency/anchor_date)
//   preferred_shift_length          shift_length_hours:number, shifts_per_week?:number
//   preferred_days                  days:number[]
//   preferred_work_type_by_day      days:number[]                         (+ work_type_id)
//   recurring_work_type_assignment  days:number[], start_time?, end_time? (+ work_type_id, frequency, anchor_date)
//   monthly_quota                   quota_per_period:number               (+ work_type_id)
//   nth_weekday_assignment          week_occurrence:1-5, day_of_week:0-6, duration_hours?, start_time? (+ work_type_id)
//   quarterly_project_days          month_occurrence:number[], quota_per_period:number (+ work_type_id)
//   float_location                  (location_id; notes)
//   per_diem_availability           quota_per_period:number, latest_end_time?
//   preferred_not_assigned          (work_type_id)

import type {
  SchedulingRuleFrequency,
  SchedulingRuleType,
  StaffSchedulingRule,
  TimeFormat,
} from "@/lib/types";
import { formatTimeCompact } from "@/lib/time-format";

export const RULE_TYPE_LABELS: Record<SchedulingRuleType, string> = {
  recurring_shift: "Regular shift",
  preferred_shift_length: "Preferred shift length",
  preferred_days: "Preferred days",
  preferred_work_type_by_day: "Work type by day",
  recurring_work_type_assignment: "Recurring work-type assignment",
  monthly_quota: "Monthly quota",
  nth_weekday_assignment: "Nth-weekday assignment",
  quarterly_project_days: "Quarterly project days",
  float_location: "Floats to another area",
  per_diem_availability: "Per-diem availability",
  preferred_not_assigned: "Don't assign",
};

export const FREQUENCY_LABELS: Record<SchedulingRuleFrequency, string> = {
  weekly: "Weekly",
  every_other_week: "Every other week",
  every_other_month: "Every other month",
  monthly_by_date: "Monthly (by date)",
  monthly_by_occurrence: "Monthly (by occurrence)",
  quarterly: "Quarterly",
  annually: "Annually",
};

const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_PLURAL = [
  "Sundays",
  "Mondays",
  "Tuesdays",
  "Wednesdays",
  "Thursdays",
  "Fridays",
  "Saturdays",
];
const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Compact time for rule text. Delegates to the central formatter so the tenant's
 *  12h/24h setting is honored. Defaults to 12h for the pure resolver's advisory
 *  labels (no tenant in scope there); UI callers pass tenant.time_format. */
export function fmtTime(t?: string | null, fmt: TimeFormat = "12h"): string {
  return formatTimeCompact(t, fmt);
}

export function ordinal(n: number): string {
  if (n === 1) return "1st";
  if (n === 2) return "2nd";
  if (n === 3) return "3rd";
  if (n === 5) return "last";
  return `${n}th`;
}

function asNums(v: unknown): number[] {
  return Array.isArray(v) ? v.filter((x) => typeof x === "number") : [];
}

/** Collapse a day list into ranges: [1,2,3,4] → "Mon–Thu"; [1,3] → "Mon, Wed". */
export function fmtDays(days: number[]): string {
  if (days.length === 0) return "";
  const sorted = [...new Set(days)].sort((a, b) => a - b);
  const parts: string[] = [];
  let start = sorted[0];
  let prev = sorted[0];
  for (let i = 1; i <= sorted.length; i++) {
    const cur = sorted[i];
    if (cur === prev + 1) {
      prev = cur;
      continue;
    }
    parts.push(start === prev ? DOW[start] : `${DOW[start]}–${DOW[prev]}`);
    start = cur;
    prev = cur;
  }
  return parts.join(", ");
}

function timeRange(p: Record<string, unknown>, fmt: TimeFormat): string {
  const s = fmtTime(p.start_time as string, fmt);
  const e = fmtTime(p.end_time as string, fmt);
  if (s && e) return `${s}–${e}`;
  return s || e || "";
}

/** A short, human sentence describing one rule. workType/location resolve ids → names.
 *  `fmt` sets the time style (defaults to 12h for the pure resolver's advisory labels;
 *  UI callers pass the tenant's time_format). */
export function describeRule(
  rule: StaffSchedulingRule,
  opts: {
    workTypeName?: (id: string) => string | undefined;
    locationName?: (id: string) => string | undefined;
  } = {},
  fmt: TimeFormat = "12h"
): string {
  const p = (rule.params ?? {}) as Record<string, unknown>;
  const wt = rule.work_type_id
    ? (opts.workTypeName?.(rule.work_type_id) ?? "work type")
    : null;
  const loc = rule.location_id
    ? (opts.locationName?.(rule.location_id) ?? "location")
    : null;
  const days = fmtDays(asNums(p.days));
  const tr = timeRange(p, fmt);
  const freq = rule.frequency ? FREQUENCY_LABELS[rule.frequency] : "";

  switch (rule.rule_type) {
    case "recurring_shift": {
      const base = `${days || "Regular days"}${tr ? `, ${tr}` : ""}`;
      const prefix =
        rule.frequency && rule.frequency !== "weekly" ? `${freq}: ` : "";
      return `${prefix}${base}${wt ? ` — ${wt}` : ""}`.trim();
    }
    case "preferred_shift_length": {
      const h = Number(p.shift_length_hours) || 0;
      const n = Number(p.shifts_per_week) || 0;
      return n
        ? `Prefers ${n}×${h}-hour shifts`
        : `Prefers ${h}-hour shifts`;
    }
    case "preferred_days":
      return `Prefers ${days || "certain days"}`;
    case "preferred_work_type_by_day":
      return `${days ? fmtDaysPlural(asNums(p.days)) : "Certain days"}: ${wt ?? "a work type"} when possible`;
    case "recurring_work_type_assignment": {
      const when = rule.frequency === "every_other_week"
        ? `Every other ${DOW[asNums(p.days)[0] ?? 1]}`
        : rule.frequency === "weekly"
          ? fmtDaysPlural(asNums(p.days))
          : `${freq ? `${freq} ` : ""}${days}`;
      return `${when}: ${wt ?? "a work type"}${tr ? `, ${tr}` : ""}`.trim();
    }
    case "monthly_quota": {
      const q = Number(p.quota_per_period) || 1;
      return `${q} ${wt ?? "shift"} day${q === 1 ? "" : "s"} per month`;
    }
    case "nth_weekday_assignment": {
      const occ = ordinal(Number(p.week_occurrence) || 1);
      const dow = DOW[Number(p.day_of_week) ?? 4] ?? "Thu";
      const dur = Number(p.duration_hours) || 0;
      return `${occ} ${dow} of each month: ${wt ?? "a work type"}${dur ? ` (${dur} hr)` : ""}`;
    }
    case "quarterly_project_days": {
      const months = asNums(p.month_occurrence)
        .map((m) => MONTHS[m - 1])
        .filter(Boolean)
        .join(", ");
      const q = Number(p.quota_per_period) || 1;
      return `${q} ${wt ?? "project"} day${q === 1 ? "" : "s"} in the last week of ${months || "set months"}`;
    }
    case "float_location":
      return `Sometimes covers ${loc ?? "another area"}`;
    case "per_diem_availability": {
      const q = Number(p.quota_per_period) || 0;
      const end = fmtTime(p.latest_end_time as string, fmt);
      return `Per diem${q ? `: ~${q} days/month` : ""}${end ? `, can work until ${end}` : ""}`;
    }
    case "preferred_not_assigned":
      return `Don't assign: ${wt ?? "certain work"}`;
  }
}

function fmtDaysPlural(days: number[]): string {
  if (days.length === 1) return DOW_PLURAL[days[0]];
  return fmtDays(days);
}
