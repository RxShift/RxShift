// Plain-language rendering for constraint rules. Extracted from constraint-manager
// so the Settings page AND the staff record render constraints identically.

import type { ConstraintRule, ConstraintRuleType } from "@/lib/types";

export const CONSTRAINT_RULE_LABELS: Record<ConstraintRuleType, string> = {
  hour_cap: "Hour cap",
  overtime: "Overtime threshold",
  unavailable_window: "Unavailable window",
  hard_stop: "Hard stop time",
  recurring_unavailable: "Recurring unavailability",
  always_off: "Always off",
  max_consecutive_days: "Max consecutive days",
};

export const CONSTRAINT_DAY_OPTIONS = [
  "mon", "tue", "wed", "thu", "fri", "sat", "sun",
];

export function describeConstraint(rule: ConstraintRule): string {
  const p = rule.params as Record<string, unknown>;
  switch (rule.rule_type) {
    case "hour_cap":
      return `${p.hours} hours per ${p.period ?? "week"}`;
    case "overtime":
      return `over ${p.threshold_hours ?? 40} hours/week`;
    case "unavailable_window": {
      const r = p.time_range as { start: string; end: string } | undefined;
      return `${(p.days as string[])?.join(", ") ?? "any day"}${r ? ` ${r.start}–${r.end}` : ""}`;
    }
    case "hard_stop":
      return `after ${p.time}${p.days ? ` on ${(p.days as string[]).join(", ")}` : ""}`;
    case "recurring_unavailable": {
      const rec = p.recurrence as
        | { days?: string[]; interval_weeks?: number }
        | undefined;
      return `${rec?.days?.join(", ") ?? ""} every ${rec?.interval_weeks ?? 1} week(s)`;
    }
    case "always_off":
      return (p.days as string[])?.join(", ") ?? "";
    case "max_consecutive_days":
      return `max ${p.max_days} days in a row`;
  }
}
