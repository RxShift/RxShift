// The deterministic ratio engine. This — not AI, not UI code — is the
// single source of compliance truth (scoping doc, principle 2.5).
//
// Counting rules (scoping doc §5):
// - A person counts only while in a counting activity. Work type decides;
//   a segment-level override can flip it; non_counting staff never count.
// - Pharmacists default to counting when no work type is assigned.
// - Technicians follow the work type's counting default.
// - Deficient when counting techs exceed pharmacists × max ratio, or when
//   any techs are counting with no pharmacist present.
// - Segments whose end <= start cross midnight and spill into the next day.

import type {
  EngineRatioRule,
  EngineSegment,
  SlotEval,
  ZoneDayEvals,
} from "./types";

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

export function minutesToTime(mins: number): string {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Does this segment's person count toward ratio while in this segment? */
export function segmentCounts(seg: EngineSegment): boolean {
  if (seg.staff.ratio_type === "non_counting") return false;
  if (seg.counts_override !== null) return seg.counts_override;
  if (seg.work_type) return seg.work_type.counting_default;
  return seg.staff.ratio_type === "pharmacist";
}

interface Interval {
  date: string;
  startMin: number;
  endMin: number; // exclusive; max 1440
  seg: EngineSegment;
}

/** Split a segment into same-day intervals, handling midnight spillover. */
function toIntervals(seg: EngineSegment): Interval[] {
  const start = timeToMinutes(seg.start_time);
  const end = timeToMinutes(seg.end_time);
  if (end > start) {
    return [{ date: seg.date, startMin: start, endMin: end, seg }];
  }
  // Crosses midnight: tail on the shift date, head on the next day
  const out: Interval[] = [];
  if (start < 1440) out.push({ date: seg.date, startMin: start, endMin: 1440, seg });
  if (end > 0)
    out.push({ date: addDays(seg.date, 1), startMin: 0, endMin: end, seg });
  return out;
}

/**
 * Evaluate one zone's segments across all dates they touch.
 * Returns only slots where at least one person is present.
 */
export function evaluateZone(
  segments: EngineSegment[],
  rule: EngineRatioRule,
  slotMinutes: number
): ZoneDayEvals {
  const byDate = new Map<string, Interval[]>();
  for (const seg of segments) {
    for (const iv of toIntervals(seg)) {
      const list = byDate.get(iv.date) ?? [];
      list.push(iv);
      byDate.set(iv.date, list);
    }
  }

  const result: ZoneDayEvals = new Map();

  for (const [date, intervals] of byDate) {
    const slots: SlotEval[] = [];
    for (let slotStart = 0; slotStart < 1440; slotStart += slotMinutes) {
      const slotEnd = slotStart + slotMinutes;
      const present = intervals.filter(
        (iv) => iv.startMin < slotEnd && iv.endMin > slotStart
      );
      if (present.length === 0) continue;

      const pharmacists = new Set<string>();
      const techsCounting = new Set<string>();
      const techsNonCounting = new Map<string, string>(); // name → function

      for (const iv of present) {
        const { seg } = iv;
        const counts = segmentCounts(seg);
        if (seg.staff.ratio_type === "pharmacist") {
          if (counts) pharmacists.add(seg.staff.full_name);
        } else if (seg.staff.ratio_type === "technician") {
          if (counts) {
            techsCounting.add(seg.staff.full_name);
          } else if (!techsCounting.has(seg.staff.full_name)) {
            techsNonCounting.set(
              seg.staff.full_name,
              seg.work_type?.name ?? "non-counting assignment"
            );
          }
        }
        // non_counting staff are never listed on the ratio evaluation
      }
      // A tech counting in one overlapping segment shouldn't also appear
      // as non-counting in the same slot
      for (const name of techsCounting) techsNonCounting.delete(name);

      const pCount = pharmacists.size;
      const tCount = techsCounting.size;

      let status: SlotEval["status"] = "compliant";
      let reason: string | null = null;

      if (tCount > 0 && pCount === 0) {
        status = "deficient";
        reason = `${tCount} technician${tCount === 1 ? "" : "s"} counting with no pharmacist on duty`;
      } else if (pCount > 0 && tCount > pCount * rule.max_techs_per_pharmacist) {
        status = "deficient";
        reason = `${tCount} technicians counting against ${pCount} pharmacist${pCount === 1 ? "" : "s"} — limit is ${rule.max_techs_per_pharmacist} per pharmacist (${pCount * rule.max_techs_per_pharmacist} total)`;
      }

      slots.push({
        slot_start: slotStart,
        slot_minutes: slotMinutes,
        pharmacists: [...pharmacists].sort(),
        techs_counting: [...techsCounting].sort(),
        techs_present_non_counting: [...techsNonCounting]
          .map(([name, fn]) => ({ name, function: fn }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        status,
        deficiency_reason: reason,
      });
    }
    if (slots.length > 0) result.set(date, slots);
  }

  return result;
}

/** Convenience: list the deficient slots as flat flags for the UI. */
export function deficientSlots(evals: ZoneDayEvals) {
  const out: { date: string; slot: SlotEval }[] = [];
  for (const [date, slots] of evals) {
    for (const slot of slots) {
      if (slot.status === "deficient") out.push({ date, slot });
    }
  }
  return out;
}
