import { describe, expect, it } from "vitest";
import {
  nonCountingWindows,
  splitByWindows,
} from "../../compliance-record";
import { evaluateZone } from "../ratio";
import { generateComplianceRecord } from "../compliance";
import type { EngineSegment } from "../types";
import type { LiveStatus } from "../../types";

const RPH: EngineSegment["staff"] = { id: "rph1", full_name: "Dr. Patel", ratio_type: "pharmacist" };
const TECH: EngineSegment["staff"] = { id: "t1", full_name: "Jerome", ratio_type: "technician" };

function seg(staff: EngineSegment["staff"], start: string, end: string): EngineSegment {
  return {
    shift_id: `s-${staff.id}`,
    location_id: "loc1",
    date: "2026-06-18",
    start_time: start,
    end_time: end,
    staff,
    // techs need a counting work type to count; pharmacists count by default
    work_type:
      staff.ratio_type === "technician"
        ? { id: "wt", name: "Dispensing", counts_as: "technician", counting_default: true }
        : null,
    counts_override: null,
  };
}

describe("splitByWindows", () => {
  it("forces the windowed minutes not-counting and leaves the rest", () => {
    const s = seg(RPH, "09:00", "17:00");
    const parts = splitByWindows(s, [{ start: 14 * 60, end: 16 * 60 }]);
    // 09:00–14:00 (kept), 14:00–16:00 (override false), 16:00–17:00 (kept)
    expect(parts).toHaveLength(3);
    expect(parts.map((p) => [p.start_time, p.end_time, p.counts_override])).toEqual([
      ["09:00", "14:00", null],
      ["14:00", "16:00", false],
      ["16:00", "17:00", null],
    ]);
  });

  it("returns the segment unchanged when there are no windows", () => {
    const s = seg(RPH, "09:00", "17:00");
    expect(splitByWindows(s, [])).toEqual([s]);
  });
});

describe("as-worked reconstruction → engine", () => {
  it("a pharmacist on lunch 2–4pm leaves the tech uncovered (deficient)", () => {
    // Scheduled: 1 RPh + 1 tech, both 09:00–17:00 → compliant all day as-scheduled.
    // Actual: the RPh was on lunch (non-counting) 14:00–16:00.
    const rphActual = splitByWindows(seg(RPH, "09:00", "17:00"), [
      { start: 14 * 60, end: 16 * 60 },
    ]);
    const segments = [...rphActual, seg(TECH, "09:00", "17:00")];
    const evals = evaluateZone(segments, { max_techs_per_pharmacist: 3 }, 30);
    const rows = generateComplianceRecord(evals, "loc1", "Loc");

    const deficientHours = rows
      .filter((r) => r.ratio_status === "deficient")
      .map((r) => r.hour)
      .sort((a, b) => a - b);
    expect(deficientHours).toEqual([14, 15]); // 2–4pm, tech counting with no RPh
    // Other staffed hours stay compliant.
    expect(rows.find((r) => r.hour === 12)?.ratio_status).toBe("compliant");
  });
});

describe("nonCountingWindows", () => {
  // Use UTC so local minutes == clock minutes for clean assertions.
  const cfg = { present_counting: true, on_lunch: false };
  const asOf = { date: "2026-06-18", minutes: 1440 };

  it("derives a window from a closed non-counting status interval", () => {
    const rows: LiveStatus[] = [
      {
        id: "l1",
        tenant_id: "t",
        staff_id: "t1",
        status: "on_lunch",
        work_type_id: null,
        effective_from: "2026-06-18T14:00:00Z",
        effective_to: "2026-06-18T16:00:00Z",
      } as LiveStatus,
    ];
    expect(nonCountingWindows(rows, "2026-06-18", "UTC", cfg, asOf)).toEqual([
      { start: 14 * 60, end: 16 * 60 },
    ]);
  });

  it("ignores a counting status", () => {
    const rows: LiveStatus[] = [
      {
        id: "l2",
        tenant_id: "t",
        staff_id: "t1",
        status: "present_counting",
        work_type_id: null,
        effective_from: "2026-06-18T09:00:00Z",
        effective_to: null,
      } as LiveStatus,
    ];
    expect(nonCountingWindows(rows, "2026-06-18", "UTC", cfg, asOf)).toEqual([]);
  });
});
