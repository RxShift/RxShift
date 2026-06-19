// R072-25 (Nevada proposed) + Tennessee engine behavior. Exercises the new
// overlays built by buildEngineRule: the 4-tech retail ceiling, the 2-trainee
// sublimit, the solo-pharmacist staffing FLOOR (Sec 2.3), Tennessee's
// certified-uncapped ceiling, and the ceiling/floor/both flag_type roll-up.
//
// The plain NV (toggle-off) and default behavior is covered by ratio.test.ts;
// these tests prove the overlays only change things when buildEngineRule turns
// them on, and that the engine default is untouched.

import { describe, expect, it } from "vitest";
import { evaluateZone } from "../ratio";
import { buildEngineRule } from "../rule";
import { generateComplianceRecord } from "../compliance";
import type { EngineSegment, EngineStaff, EngineWorkType } from "../types";

// ── staff builders ──
const rph = (name = "Sue RPh"): EngineStaff => ({
  id: `rph-${name}`,
  full_name: name,
  ratio_type: "pharmacist",
});
const tech = (
  name: string,
  attrs: { is_trainee?: boolean; certified?: boolean } = {}
): EngineStaff => ({
  id: `tech-${name}`,
  full_name: name,
  ratio_type: "technician",
  ...attrs,
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
    counts_override: null,
  };
}

// ── rules, built the way the app builds them ──
const NV_STORED = { state: "NV", max_techs_per_pharmacist: 3 };
const TN_STORED = { state: "TN", max_techs_per_pharmacist: 6 };

const r072Retail = buildEngineRule(NV_STORED, {
  locationType: "retail",
  hasDriveThrough: false,
  r072Enabled: true,
});
const r072RetailDriveThru = buildEngineRule(NV_STORED, {
  locationType: "retail",
  hasDriveThrough: true,
  r072Enabled: true,
});
const r072Telepharmacy = buildEngineRule(NV_STORED, {
  locationType: "telepharmacy",
  hasDriveThrough: false,
  r072Enabled: true,
});
const tnRule = buildEngineRule(TN_STORED);

const firstSlot = (segs: EngineSegment[], rule: ReturnType<typeof buildEngineRule>) =>
  evaluateZone(segs, rule, 30).get("2026-06-15")![0];

describe("buildEngineRule overlays", () => {
  it("R072 retail → 4-tech ceiling, 2-trainee sublimit, floor of 1 (no drive-through)", () => {
    expect(r072Retail.max_techs_per_pharmacist).toBe(4);
    expect(r072Retail.max_trainees_per_pharmacist).toBe(2);
    expect(r072Retail.floor_min_support).toBe(1);
    expect(r072Retail.certified_uncapped).toBe(false);
  });
  it("R072 retail with a drive-through → floor of 2", () => {
    expect(r072RetailDriveThru.floor_min_support).toBe(2);
  });
  it("R072 does NOT apply to telepharmacy (cap stays 3, no floor)", () => {
    expect(r072Telepharmacy.max_techs_per_pharmacist).toBe(3);
    expect(r072Telepharmacy.floor_min_support).toBeNull();
    expect(r072Telepharmacy.max_trainees_per_pharmacist).toBeNull();
  });
  it("toggle off (no ctx) reproduces the stored cap with no overlays", () => {
    const off = buildEngineRule(NV_STORED);
    expect(off.max_techs_per_pharmacist).toBe(3);
    expect(off.floor_min_support).toBeNull();
    expect(off.max_trainees_per_pharmacist).toBeNull();
    expect(off.certified_uncapped).toBe(false);
  });
  it("Tennessee → 6-tech cap, certified uncapped", () => {
    expect(tnRule.max_techs_per_pharmacist).toBe(6);
    expect(tnRule.certified_uncapped).toBe(true);
  });
});

describe("R072-25 staffing floor (solo pharmacist)", () => {
  it("solo RPh with no support staff is deficient (floor) at a non-drive-through site", () => {
    const slot = firstSlot([seg(rph(), "08:00", "12:00", null)], r072Retail);
    expect(slot.status).toBe("deficient");
    expect(slot.flag_type).toBe("floor");
    expect(slot.deficiency_reason).toContain("solo pharmacist");
  });

  it("solo RPh with one tech satisfies the floor (no drive-through)", () => {
    const slot = firstSlot(
      [seg(rph(), "08:00", "12:00", null), seg(tech("Ann"), "08:00", "12:00")],
      r072Retail
    );
    expect(slot.status).toBe("compliant");
    expect(slot.flag_type).toBeNull();
  });

  it("a non-counting tech still counts as a body on the floor", () => {
    // Tech is on Inventory (non-counting work type) — does NOT count toward the
    // ceiling, but IS present, so the floor is satisfied and there's no ceiling hit.
    const slot = firstSlot(
      [seg(rph(), "08:00", "12:00", null), seg(tech("Ann"), "08:00", "12:00", inventory)],
      r072Retail
    );
    expect(slot.status).toBe("compliant");
  });

  it("drive-through site needs TWO support staff for a solo pharmacist", () => {
    const one = firstSlot(
      [seg(rph(), "08:00", "12:00", null), seg(tech("Ann"), "08:00", "12:00")],
      r072RetailDriveThru
    );
    expect(one.status).toBe("deficient");
    expect(one.flag_type).toBe("floor");

    const two = firstSlot(
      [
        seg(rph(), "08:00", "12:00", null),
        seg(tech("Ann"), "08:00", "12:00"),
        seg(tech("Bo"), "08:00", "12:00"),
      ],
      r072RetailDriveThru
    );
    expect(two.status).toBe("compliant");
  });

  it("the floor applies only to a SOLO pharmacist — two RPhs with no tech is fine", () => {
    const slot = firstSlot(
      [seg(rph("Sue"), "08:00", "12:00", null), seg(rph("Ray"), "08:00", "12:00", null)],
      r072Retail
    );
    expect(slot.status).toBe("compliant");
  });
});

describe("R072-25 retail 4-tech ceiling + trainee sublimit", () => {
  it("four counting techs under one RPh is compliant (was 3 pre-R072)", () => {
    const slot = firstSlot(
      [
        seg(rph(), "08:00", "16:00", null),
        seg(tech("Ann"), "08:00", "16:00"),
        seg(tech("Bo"), "08:00", "16:00"),
        seg(tech("Cy"), "08:00", "16:00"),
        seg(tech("Di"), "08:00", "16:00"),
      ],
      r072Retail
    );
    expect(slot.status).toBe("compliant");
  });

  it("five counting techs under one RPh exceeds the 4-tech ceiling", () => {
    const slot = firstSlot(
      [
        seg(rph(), "08:00", "16:00", null),
        seg(tech("Ann"), "08:00", "16:00"),
        seg(tech("Bo"), "08:00", "16:00"),
        seg(tech("Cy"), "08:00", "16:00"),
        seg(tech("Di"), "08:00", "16:00"),
        seg(tech("Ed"), "08:00", "16:00"),
      ],
      r072Retail
    );
    expect(slot.status).toBe("deficient");
    expect(slot.flag_type).toBe("ceiling");
  });

  it("2 techs + 2 trainees (4 total) is within both the ceiling and the sublimit", () => {
    const slot = firstSlot(
      [
        seg(rph(), "08:00", "16:00", null),
        seg(tech("Ann"), "08:00", "16:00"),
        seg(tech("Bo"), "08:00", "16:00"),
        seg(tech("Trish", { is_trainee: true }), "08:00", "16:00"),
        seg(tech("Tom", { is_trainee: true }), "08:00", "16:00"),
      ],
      r072Retail
    );
    expect(slot.status).toBe("compliant");
  });

  it("1 tech + 3 trainees (4 total, within ceiling) still breaks the 2-trainee sublimit", () => {
    const slot = firstSlot(
      [
        seg(rph(), "08:00", "16:00", null),
        seg(tech("Ann"), "08:00", "16:00"),
        seg(tech("Trish", { is_trainee: true }), "08:00", "16:00"),
        seg(tech("Tom", { is_trainee: true }), "08:00", "16:00"),
        seg(tech("Tess", { is_trainee: true }), "08:00", "16:00"),
      ],
      r072Retail
    );
    expect(slot.status).toBe("deficient");
    expect(slot.flag_type).toBe("ceiling");
    expect(slot.deficiency_reason).toContain("training");
  });
});

describe("Tennessee certified-uncapped ceiling", () => {
  it("six non-certified techs under one RPh is compliant (at the cap)", () => {
    const slot = firstSlot(
      [
        seg(rph(), "08:00", "16:00", null),
        ...["A", "B", "C", "D", "E", "F"].map((n) => seg(tech(n), "08:00", "16:00")),
      ],
      tnRule
    );
    expect(slot.status).toBe("compliant");
  });

  it("seven non-certified techs exceeds the 6-tech cap", () => {
    const slot = firstSlot(
      [
        seg(rph(), "08:00", "16:00", null),
        ...["A", "B", "C", "D", "E", "F", "G"].map((n) => seg(tech(n), "08:00", "16:00")),
      ],
      tnRule
    );
    expect(slot.status).toBe("deficient");
    expect(slot.flag_type).toBe("ceiling");
    expect(slot.deficiency_reason).toContain("non-certified");
  });

  it("certified (CPhT) techs do not count toward the cap — ten certified is fine", () => {
    const slot = firstSlot(
      [
        seg(rph(), "08:00", "16:00", null),
        ...Array.from({ length: 10 }, (_, i) =>
          seg(tech(`C${i}`, { certified: true }), "08:00", "16:00")
        ),
      ],
      tnRule
    );
    expect(slot.status).toBe("compliant");
  });

  it("only the non-certified techs count: 6 non-certified + 4 certified is compliant", () => {
    const slot = firstSlot(
      [
        seg(rph(), "08:00", "16:00", null),
        ...["A", "B", "C", "D", "E", "F"].map((n) => seg(tech(n), "08:00", "16:00")),
        ...["G", "H", "I", "J"].map((n) =>
          seg(tech(n, { certified: true }), "08:00", "16:00")
        ),
      ],
      tnRule
    );
    expect(slot.status).toBe("compliant");
  });
});

describe("flag_type roll-up across an hour", () => {
  it("an hour with a floor slot AND a ceiling slot rolls up to 'both'", () => {
    // 08:00–08:30: solo RPh, no support → floor; 08:30–09:00: solo RPh + 5 techs → ceiling.
    const evals = evaluateZone(
      [
        seg(rph(), "08:00", "09:00", null),
        ...["A", "B", "C", "D", "E"].map((n) => seg(tech(n), "08:30", "09:00")),
      ],
      r072Retail,
      30
    );
    const rows = generateComplianceRecord(evals, "loc1", "Spring Valley");
    const hour8 = rows.find((r) => r.hour === 8)!;
    expect(hour8.ratio_status).toBe("deficient");
    expect(hour8.flag_type).toBe("both");
  });
});
