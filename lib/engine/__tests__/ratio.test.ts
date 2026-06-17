import { describe, expect, it } from "vitest";
import {
  evaluateZone,
  maxTechsAllowed,
  minPharmacistsFor,
  pharmacistHeadroom,
  segmentCounts,
  timeToMinutes,
  wouldBreakIfOneLeaves,
} from "../ratio";
import type { EngineSegment, EngineStaff, EngineWorkType } from "../types";

const rph = (name = "Sue RPh"): EngineStaff => ({
  id: `rph-${name}`,
  full_name: name,
  ratio_type: "pharmacist",
});
const tech = (name: string): EngineStaff => ({
  id: `tech-${name}`,
  full_name: name,
  ratio_type: "technician",
});
const cashier = (name = "Cal Cashier"): EngineStaff => ({
  id: `nc-${name}`,
  full_name: name,
  ratio_type: "non_counting",
});

const dispensing: EngineWorkType = {
  id: "wt-disp",
  name: "Dispensing",
  counts_as: "technician",
  counting_default: true,
};
const inventory: EngineWorkType = {
  id: "wt-inv",
  name: "Inventory",
  counts_as: "technician",
  counting_default: false,
};

function seg(
  staff: EngineStaff,
  start: string,
  end: string,
  workType: EngineWorkType | null = dispensing,
  override: boolean | null = null,
  date = "2026-06-15"
): EngineSegment {
  return {
    shift_id: `shift-${staff.id}-${start}`,
    location_id: "loc1",
    date,
    start_time: start,
    end_time: end,
    staff,
    work_type: workType,
    counts_toward_ratio: undefined as never,
    counts_override: override,
  } as unknown as EngineSegment;
}

const RULE = { max_techs_per_pharmacist: 3 };

describe("segmentCounts", () => {
  it("pharmacist with no work type counts by default", () => {
    expect(segmentCounts(seg(rph(), "08:00", "16:00", null))).toBe(true);
  });
  it("technician follows the work type counting default", () => {
    expect(segmentCounts(seg(tech("Ann"), "08:00", "16:00", dispensing))).toBe(true);
    expect(segmentCounts(seg(tech("Ann"), "08:00", "16:00", inventory))).toBe(false);
  });
  it("segment override beats the work type default", () => {
    expect(segmentCounts(seg(tech("Ann"), "08:00", "16:00", dispensing, false))).toBe(false);
    expect(segmentCounts(seg(tech("Ann"), "08:00", "16:00", inventory, true))).toBe(true);
  });
  it("non-counting staff never count, even with an override", () => {
    expect(segmentCounts(seg(cashier(), "08:00", "16:00", dispensing, true))).toBe(false);
  });
});

describe("evaluateZone", () => {
  it("compliant when techs are within the ratio", () => {
    const evals = evaluateZone(
      [
        seg(rph(), "08:00", "16:00", null),
        seg(tech("Ann"), "08:00", "16:00"),
        seg(tech("Bo"), "08:00", "16:00"),
        seg(tech("Cy"), "08:00", "16:00"),
      ],
      RULE,
      30
    );
    const slots = evals.get("2026-06-15")!;
    expect(slots.every((s) => s.status === "compliant")).toBe(true);
    expect(slots[0].techs_counting).toHaveLength(3);
  });

  it("deficient when the ratio is exceeded", () => {
    const evals = evaluateZone(
      [
        seg(rph(), "08:00", "16:00", null),
        seg(tech("Ann"), "08:00", "16:00"),
        seg(tech("Bo"), "08:00", "16:00"),
        seg(tech("Cy"), "08:00", "16:00"),
        seg(tech("Di"), "08:00", "16:00"),
      ],
      RULE,
      30
    );
    const slots = evals.get("2026-06-15")!;
    expect(slots[0].status).toBe("deficient");
    expect(slots[0].deficiency_reason).toContain("4 technicians");
  });

  it("deficient when techs count with no pharmacist", () => {
    const evals = evaluateZone([seg(tech("Ann"), "08:00", "12:00")], RULE, 30);
    const slots = evals.get("2026-06-15")!;
    expect(slots[0].status).toBe("deficient");
    expect(slots[0].deficiency_reason).toContain("no pharmacist");
  });

  it("only deficient in the slots where coverage is actually short", () => {
    const evals = evaluateZone(
      [
        seg(rph(), "08:00", "12:00", null), // pharmacist leaves at noon
        seg(tech("Ann"), "08:00", "16:00"),
      ],
      RULE,
      30
    );
    const slots = evals.get("2026-06-15")!;
    const noon = slots.find((s) => s.slot_start === timeToMinutes("12:00"))!;
    const morning = slots.find((s) => s.slot_start === timeToMinutes("09:00"))!;
    expect(morning.status).toBe("compliant");
    expect(noon.status).toBe("deficient");
  });

  it("a tech split between counting and non-counting work flips mid-shift", () => {
    const evals = evaluateZone(
      [
        seg(rph(), "08:00", "16:00", null),
        seg(tech("Ann"), "08:00", "12:00", dispensing),
        seg(tech("Ann"), "12:00", "16:00", inventory),
      ],
      RULE,
      30
    );
    const slots = evals.get("2026-06-15")!;
    const at9 = slots.find((s) => s.slot_start === timeToMinutes("09:00"))!;
    const at13 = slots.find((s) => s.slot_start === timeToMinutes("13:00"))!;
    expect(at9.techs_counting).toEqual(["Ann"]);
    expect(at13.techs_counting).toEqual([]);
    expect(at13.techs_present_non_counting).toEqual([
      { name: "Ann", function: "Inventory" },
    ]);
  });

  it("overnight segments spill into the next day", () => {
    const evals = evaluateZone(
      [
        seg(rph(), "22:00", "06:00", null),
        seg(tech("Ann"), "22:00", "06:00"),
      ],
      RULE,
      60
    );
    expect(evals.has("2026-06-15")).toBe(true);
    expect(evals.has("2026-06-16")).toBe(true);
    const nextDay = evals.get("2026-06-16")!;
    expect(nextDay[0].slot_start).toBe(0);
    expect(nextDay.at(-1)!.slot_start).toBe(timeToMinutes("05:00"));
    expect(nextDay.every((s) => s.status === "compliant")).toBe(true);
  });

  it("non-counting staff never appear in the evaluation", () => {
    const evals = evaluateZone(
      [seg(rph(), "08:00", "12:00", null), seg(cashier(), "08:00", "12:00")],
      RULE,
      30
    );
    const slots = evals.get("2026-06-15")!;
    expect(slots[0].techs_counting).toEqual([]);
    expect(slots[0].techs_present_non_counting).toEqual([]);
  });
});

describe("additive formula (California BPC 4115: max techs = 2P − 1)", () => {
  const CA_RULE = {
    max_techs_per_pharmacist: 1, // ignored under additive
    formula: "additive" as const,
    additive_first_techs: 1,
    additive_additional_techs: 2,
  };

  it("maxTechsAllowed follows 2P − 1", () => {
    expect(maxTechsAllowed(1, CA_RULE)).toBe(1);
    expect(maxTechsAllowed(2, CA_RULE)).toBe(3);
    expect(maxTechsAllowed(3, CA_RULE)).toBe(5);
    expect(maxTechsAllowed(0, CA_RULE)).toBe(0);
    // and flat rules are unchanged
    expect(maxTechsAllowed(2, RULE)).toBe(6);
  });

  it("1 pharmacist + 1 tech is compliant; + 2 techs is deficient", () => {
    const ok = evaluateZone(
      [seg(rph(), "08:00", "12:00", null), seg(tech("Ann"), "08:00", "12:00")],
      CA_RULE,
      30
    );
    expect(ok.get("2026-06-15")![0].status).toBe("compliant");

    const bad = evaluateZone(
      [
        seg(rph(), "08:00", "12:00", null),
        seg(tech("Ann"), "08:00", "12:00"),
        seg(tech("Bo"), "08:00", "12:00"),
      ],
      CA_RULE,
      30
    );
    const slot = bad.get("2026-06-15")![0];
    expect(slot.status).toBe("deficient");
    expect(slot.deficiency_reason).toContain("additive limit is 1");
  });

  it("2 pharmacists + 3 techs compliant; + 4 deficient (not 2×cap math)", () => {
    const base = [
      seg(rph("Dr A"), "08:00", "12:00", null),
      seg(rph("Dr B"), "08:00", "12:00", null),
      seg(tech("Ann"), "08:00", "12:00"),
      seg(tech("Bo"), "08:00", "12:00"),
      seg(tech("Cy"), "08:00", "12:00"),
    ];
    expect(evaluateZone(base, CA_RULE, 30).get("2026-06-15")![0].status).toBe(
      "compliant"
    );
    expect(
      evaluateZone(
        [...base, seg(tech("Di"), "08:00", "12:00")],
        CA_RULE,
        30
      ).get("2026-06-15")![0].status
    ).toBe("deficient");
  });
});

describe("pharmacist headroom — can I step away without breaking ratio?", () => {
  const CA = {
    max_techs_per_pharmacist: 1,
    formula: "additive" as const,
    additive_first_techs: 1,
    additive_additional_techs: 2,
  };

  it("minPharmacistsFor on a flat rule (3 techs/pharmacist)", () => {
    expect(minPharmacistsFor(0, RULE)).toBe(0);
    expect(minPharmacistsFor(1, RULE)).toBe(1);
    expect(minPharmacistsFor(24, RULE)).toBe(8); // ceil(24/3)
  });

  it("OptumRx case: 10 RPh / 24 techs at 3 per RPh → 2 can step away", () => {
    expect(pharmacistHeadroom(10, 24, RULE)).toBe(2);
    expect(wouldBreakIfOneLeaves(10, 24, RULE)).toBe(false);
  });

  it("at the limit: 2 RPh / 4 techs → 0 headroom, one leaving breaks it", () => {
    expect(pharmacistHeadroom(2, 4, RULE)).toBe(0);
    expect(wouldBreakIfOneLeaves(2, 4, RULE)).toBe(true);
  });

  it("no counting techs → ratio can't break; full headroom", () => {
    expect(pharmacistHeadroom(2, 0, RULE)).toBe(2);
    expect(wouldBreakIfOneLeaves(2, 0, RULE)).toBe(false);
  });

  it("additive (CA 2P−1): 3 RPh / 3 techs → 1 can leave; 2 RPh / 3 techs → 0", () => {
    expect(pharmacistHeadroom(3, 3, CA)).toBe(1);
    expect(wouldBreakIfOneLeaves(3, 3, CA)).toBe(false);
    expect(pharmacistHeadroom(2, 3, CA)).toBe(0);
    expect(wouldBreakIfOneLeaves(2, 3, CA)).toBe(true);
  });
});
