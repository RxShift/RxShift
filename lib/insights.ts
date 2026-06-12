import "server-only";

// Proactive insights (scoping §5, Tier B) — computed deterministically
// from schedule data. AI is not needed to spot these patterns; accuracy
// beats phrasing.

import type { PeriodBundle, ValidationOut } from "@/lib/schedule-data";
import { timeToMinutes } from "@/lib/engine/ratio";

export interface Insight {
  tone: "alert" | "deficiency" | "neutral";
  text: string;
}

const DOW = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function computeInsights(
  bundle: PeriodBundle,
  validation: ValidationOut
): Insight[] {
  const insights: Insight[] = [];

  // Deficient hours this period
  const deficientSlotCount = validation.ratioFlags.length;
  if (deficientSlotCount > 0) {
    const dates = new Set(validation.ratioFlags.map((f) => f.date));
    insights.push({
      tone: "deficiency",
      text: `${deficientSlotCount} deficient ratio slot${deficientSlotCount === 1 ? "" : "s"} across ${dates.size} day${dates.size === 1 ? "" : "s"} in this period. Open the schedule to see exactly where.`,
    });
  }

  // Weekday pattern in deficiencies
  const byDow = new Map<number, number>();
  for (const f of validation.ratioFlags) {
    const dow = new Date(`${f.date}T00:00:00Z`).getUTCDay();
    byDow.set(dow, (byDow.get(dow) ?? 0) + 1);
  }
  for (const [dow, count] of byDow) {
    if (count >= 3) {
      const morning = validation.ratioFlags.filter(
        (f) =>
          new Date(`${f.date}T00:00:00Z`).getUTCDay() === dow &&
          timeToMinutes(f.slot_label.split("–")[0]) < 12 * 60
      ).length;
      insights.push({
        tone: "alert",
        text: `${DOW[dow]}s are a recurring gap — ${count} deficient slots${morning > count / 2 ? ", mostly mornings" : ""}. Consider a standing staffing change.`,
      });
    }
  }

  // Staff trending toward hour caps (>= 80% of any cap)
  const capRules = bundle.constraints.filter((c) => c.rule_type === "hour_cap" && c.active);
  for (const rule of capRules) {
    if (rule.scope_type !== "staff") continue;
    const person = bundle.staff.find((s) => s.id === rule.scope_id);
    if (!person) continue;
    const cap = Number(rule.params.hours ?? 0);
    if (cap <= 0) continue;
    let hours = 0;
    for (const shift of bundle.shifts) {
      if (shift.staff_id !== person.id) continue;
      for (const seg of shift.segments) {
        const start = timeToMinutes(String(seg.start_time).slice(0, 5));
        const end = timeToMinutes(String(seg.end_time).slice(0, 5));
        hours += (end > start ? end - start : 1440 - start + end) / 60;
      }
    }
    const pct = (hours / cap) * 100;
    if (pct >= 80 && pct <= 100) {
      insights.push({
        tone: "alert",
        text: `${person.full_name} is at ${hours.toFixed(0)} of ${cap} capped hours (${pct.toFixed(0)}%) this period — trending toward the cap.`,
      });
    }
  }

  // Constraint flags
  if (validation.constraintFlags.length > 0) {
    insights.push({
      tone: "alert",
      text: `${validation.constraintFlags.length} hours/availability flag${validation.constraintFlags.length === 1 ? "" : "s"} open — review them on the schedule before publishing.`,
    });
  }

  if (insights.length === 0) {
    insights.push({
      tone: "neutral",
      text: "No compliance risks detected in the current period. Ratio coverage and constraint rules all check out.",
    });
  }

  return insights;
}
