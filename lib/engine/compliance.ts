// Compliance record generator — Appendix D. Rolls slot-level evaluations
// up to hourly rows: who was on duty, who counted, who was present but
// not counting (with their assigned function — the documented exception
// that is the audit defense), and compliant/deficient status per hour.

import type { ComplianceRecordRow } from "@/lib/types";
import type { DayEvals } from "./types";

export function generateComplianceRecord(
  evals: DayEvals,
  locationId: string,
  locationName: string
): ComplianceRecordRow[] {
  const rows: ComplianceRecordRow[] = [];

  for (const [date, slots] of [...evals.entries()].sort()) {
    const byHour = new Map<number, typeof slots>();
    for (const slot of slots) {
      const hour = Math.floor(slot.slot_start / 60);
      const list = byHour.get(hour) ?? [];
      list.push(slot);
      byHour.set(hour, list);
    }

    for (const [hour, hourSlots] of [...byHour.entries()].sort(
      (a, b) => a[0] - b[0]
    )) {
      const pharmacists = new Set<string>();
      const techsCounting = new Set<string>();
      const nonCounting = new Map<string, string>();
      let deficient = false;
      let reason: string | null = null;

      for (const slot of hourSlots) {
        slot.pharmacists.forEach((n) => pharmacists.add(n));
        slot.techs_counting.forEach((n) => techsCounting.add(n));
        slot.techs_present_non_counting.forEach((t) =>
          nonCounting.set(t.name, t.function)
        );
        if (slot.status === "deficient" && !deficient) {
          deficient = true;
          reason = slot.deficiency_reason;
        }
      }
      for (const name of techsCounting) nonCounting.delete(name);

      rows.push({
        date,
        hour,
        location_id: locationId,
        location_name: locationName,
        pharmacists_on_duty: [...pharmacists].sort(),
        technicians_counting: [...techsCounting].sort(),
        technicians_count: techsCounting.size,
        technicians_present_non_counting: [...nonCounting]
          .map(([name, fn]) => ({ name, function: fn }))
          .sort((a, b) => a.name.localeCompare(b.name)),
        ratio_status: deficient ? "deficient" : "compliant",
        deficiency_reason: reason,
      });
    }
  }

  return rows;
}

/**
 * Consecutive-deficient-day tracking + the board-report trigger after
 * three consecutive deficient days (per the structure of proposed R113-24).
 */
export function deficiencyStreaks(rows: ComplianceRecordRow[]): {
  deficientDates: string[];
  streaks: { start: string; length: number }[];
  boardReportTriggered: boolean;
} {
  const deficientDates = [
    ...new Set(
      rows.filter((r) => r.ratio_status === "deficient").map((r) => r.date)
    ),
  ].sort();

  const streaks: { start: string; length: number }[] = [];
  let start: string | null = null;
  let prev: string | null = null;
  let len = 0;

  const nextDay = (d: string) => {
    const dt = new Date(`${d}T00:00:00Z`);
    dt.setUTCDate(dt.getUTCDate() + 1);
    return dt.toISOString().slice(0, 10);
  };

  for (const date of deficientDates) {
    if (prev !== null && date === nextDay(prev)) {
      len += 1;
    } else {
      if (start && len > 0) streaks.push({ start, length: len });
      start = date;
      len = 1;
    }
    prev = date;
  }
  if (start && len > 0) streaks.push({ start, length: len });

  return {
    deficientDates,
    streaks,
    boardReportTriggered: streaks.some((s) => s.length >= 3),
  };
}

/** CSV export of the record — one row per hour. */
export function complianceRecordToCsv(rows: ComplianceRecordRow[]): string {
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const header = [
    "Date",
    "Hour",
    "Location",
    "Pharmacists on duty",
    "Technicians counting",
    "Technician count",
    "Present, not counting (function)",
    "Status",
    "Deficiency reason",
  ].join(",");

  const lines = rows.map((r) =>
    [
      r.date,
      `${String(r.hour).padStart(2, "0")}:00`,
      esc(r.location_name),
      esc(r.pharmacists_on_duty.join("; ")),
      esc((r.technicians_counting as string[]).join("; ")),
      String(r.technicians_count),
      esc(
        r.technicians_present_non_counting
          .map((t) => `${t.name} (${t.function})`)
          .join("; ")
      ),
      r.ratio_status,
      esc(r.deficiency_reason ?? ""),
    ].join(",")
  );

  return [header, ...lines].join("\n");
}
