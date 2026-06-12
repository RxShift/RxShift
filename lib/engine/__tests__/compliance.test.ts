import { describe, expect, it } from "vitest";
import { evaluateZone } from "../ratio";
import {
  complianceRecordToCsv,
  deficiencyStreaks,
  generateComplianceRecord,
} from "../compliance";
import type { ComplianceRecordRow } from "@/lib/types";
import type { EngineSegment, EngineStaff, EngineWorkType } from "../types";

const rph: EngineStaff = { id: "p1", full_name: "Sue RPh", ratio_type: "pharmacist" };
const annie: EngineStaff = { id: "t1", full_name: "Ann", ratio_type: "technician" };
const dispensing: EngineWorkType = {
  id: "wt1",
  name: "Dispensing",
  counts_as: "technician",
  counting_default: true,
};
const cleaning: EngineWorkType = {
  id: "wt2",
  name: "Cleaning",
  counts_as: "technician",
  counting_default: false,
};

function seg(
  staff: EngineStaff,
  start: string,
  end: string,
  wt: EngineWorkType | null,
  date: string
): EngineSegment {
  return {
    shift_id: `s-${staff.id}-${date}`,
    zone_id: "z1",
    date,
    start_time: start,
    end_time: end,
    staff,
    work_type: wt,
    counts_override: null,
  };
}

describe("generateComplianceRecord", () => {
  it("rolls 30-minute slots up to hourly rows with documented exceptions", () => {
    const evals = evaluateZone(
      [
        seg(rph, "08:00", "10:00", null, "2026-06-15"),
        seg(annie, "08:00", "09:00", dispensing, "2026-06-15"),
        seg(annie, "09:00", "10:00", cleaning, "2026-06-15"),
      ],
      { max_techs_per_pharmacist: 3 },
      30
    );
    const rows = generateComplianceRecord(evals, "z1", "Main Floor");
    expect(rows).toHaveLength(2); // 08:00 and 09:00 hours
    expect(rows[0].technicians_counting).toEqual(["Ann"]);
    expect(rows[1].technicians_counting).toEqual([]);
    // The audit defense: present but annotated as not counting
    expect(rows[1].technicians_present_non_counting).toEqual([
      { name: "Ann", function: "Cleaning" },
    ]);
    expect(rows.every((r) => r.ratio_status === "compliant")).toBe(true);
  });

  it("an hour is deficient if any slot inside it is deficient", () => {
    const evals = evaluateZone(
      [
        seg(rph, "08:00", "08:30", null, "2026-06-15"), // leaves mid-hour
        seg(annie, "08:00", "09:00", dispensing, "2026-06-15"),
      ],
      { max_techs_per_pharmacist: 3 },
      30
    );
    const rows = generateComplianceRecord(evals, "z1", "Main Floor");
    expect(rows[0].ratio_status).toBe("deficient");
    expect(rows[0].deficiency_reason).toContain("no pharmacist");
  });
});

describe("deficiencyStreaks", () => {
  const row = (date: string, deficient: boolean): ComplianceRecordRow => ({
    date,
    hour: 9,
    zone_id: "z1",
    zone_name: "Main",
    pharmacists_on_duty: [],
    technicians_counting: [],
    technicians_count: 0,
    technicians_present_non_counting: [],
    ratio_status: deficient ? "deficient" : "compliant",
    deficiency_reason: deficient ? "test" : null,
  });

  it("triggers the board report after three consecutive deficient days", () => {
    const rows = [
      row("2026-06-15", true),
      row("2026-06-16", true),
      row("2026-06-17", true),
      row("2026-06-18", false),
    ];
    const result = deficiencyStreaks(rows);
    expect(result.streaks).toEqual([{ start: "2026-06-15", length: 3 }]);
    expect(result.boardReportTriggered).toBe(true);
  });

  it("non-consecutive deficient days do not trigger", () => {
    const rows = [
      row("2026-06-15", true),
      row("2026-06-17", true),
      row("2026-06-19", true),
    ];
    const result = deficiencyStreaks(rows);
    expect(result.boardReportTriggered).toBe(false);
    expect(result.streaks).toHaveLength(3);
  });
});

describe("complianceRecordToCsv", () => {
  it("escapes and formats", () => {
    const evals = evaluateZone(
      [seg(rph, "08:00", "09:00", null, "2026-06-15")],
      { max_techs_per_pharmacist: 3 },
      60
    );
    const csv = complianceRecordToCsv(
      generateComplianceRecord(evals, "z1", "Main Floor")
    );
    expect(csv.split("\n")[0]).toContain("Pharmacists on duty");
    expect(csv).toContain("Sue RPh");
    expect(csv).toContain("compliant");
  });
});
