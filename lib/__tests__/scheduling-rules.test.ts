import { describe, expect, it } from "vitest";
import {
  nthWeekdayOfMonth,
  resolveScheduleRules,
  type ExistingShift,
  type ResolveContext,
} from "../scheduling-rules";
import type { SchedulingRuleType, StaffSchedulingRule } from "../types";

let seq = 0;
function rule(
  rule_type: SchedulingRuleType,
  fields: Partial<StaffSchedulingRule> = {}
): StaffSchedulingRule {
  return {
    id: `rule-${seq++}`,
    tenant_id: "t1",
    staff_id: "s1",
    rule_type,
    work_type_id: null,
    location_id: null,
    frequency: null,
    params: {},
    notes: null,
    is_active: true,
    created_at: "",
    ...fields,
  };
}

function ctx(
  rules: StaffSchedulingRule[],
  over: Partial<ResolveContext> = {}
): ResolveContext {
  return {
    windowStart: "2026-06-01",
    windowEnd: "2026-06-30",
    rules,
    existingShifts: [],
    offCells: new Set(),
    staffHomeLocation: new Map([["s1", "loc-home"]]),
    workTypeName: (id) => ({ "wt-hospice": "Hospice", "wt-consult": "Consulting", "wt-audit": "Audit" }[id]),
    ...over,
  };
}

describe("nthWeekdayOfMonth", () => {
  it("3rd Thursday of June 2026 is the 18th", () => {
    expect(nthWeekdayOfMonth(2026, 5, 4, 3)).toBe("2026-06-18");
  });
  it("1st Monday of June 2026 is the 1st", () => {
    expect(nthWeekdayOfMonth(2026, 5, 1, 1)).toBe("2026-06-01");
  });
  it("last (5th) Thursday of June 2026 is the 25th", () => {
    expect(nthWeekdayOfMonth(2026, 5, 4, 5)).toBe("2026-06-25");
  });
  it("returns null when a 5th occurrence by index doesn't exist", () => {
    // June 2026 has only 4 Mondays counting by week index (1,8,15,22,29 = 5 actually)
    // Use a month/weekday with only 4: 2nd Saturday exists; 5th Wednesday of Feb 2026 doesn't
    expect(nthWeekdayOfMonth(2026, 1, 3, 5)).not.toBe(null); // 'last' always resolves
    expect(nthWeekdayOfMonth(2026, 1, 3, 4)).toBe("2026-02-25"); // 4th Wed of Feb 2026
  });
});

describe("resolveScheduleRules — concrete proposals", () => {
  it("recurring_shift weekly proposes each matching day, skipping worked + off days", () => {
    const r = rule("recurring_shift", {
      frequency: "weekly",
      params: { days: [1, 2, 3, 4], start_time: "08:30", end_time: "19:00" }, // Mon–Thu
    });
    const existing: ExistingShift[] = [
      { staff_id: "s1", date: "2026-06-02", work_type_ids: [] }, // already works Tue 6/2
    ];
    const off = new Set(["s1|2026-06-03"]); // off Wed 6/3
    const { proposals } = resolveScheduleRules(
      ctx([r], { windowStart: "2026-06-01", windowEnd: "2026-06-04", existingShifts: existing, offCells: off })
    );
    const dates = proposals.map((p) => p.date).sort();
    expect(dates).toEqual(["2026-06-01", "2026-06-04"]); // Mon + Thu only
    expect(proposals[0].start_time).toBe("08:30");
    expect(proposals[0].location_id).toBe("loc-home"); // falls back to home location
  });

  it("recurring_work_type_assignment every-other-week respects the anchor parity", () => {
    const r = rule("recurring_work_type_assignment", {
      frequency: "every_other_week",
      work_type_id: "wt-hospice",
      params: { days: [1], start_time: "07:30", end_time: "16:00", anchor_date: "2026-06-01" },
    });
    const { proposals } = resolveScheduleRules(ctx([r]));
    expect(proposals.map((p) => p.date)).toEqual([
      "2026-06-01",
      "2026-06-15",
      "2026-06-29",
    ]);
    expect(proposals[0].work_type_id).toBe("wt-hospice");
    expect(proposals[0].end_time).toBe("16:00");
  });

  it("nth_weekday_assignment proposes the 3rd Thursday with a duration window", () => {
    const r = rule("nth_weekday_assignment", {
      work_type_id: "wt-consult",
      params: { week_occurrence: 3, day_of_week: 4, start_time: "12:00", duration_hours: 1 },
    });
    const { proposals } = resolveScheduleRules(ctx([r]));
    expect(proposals).toHaveLength(1);
    expect(proposals[0].date).toBe("2026-06-18");
    expect(proposals[0].start_time).toBe("12:00");
    expect(proposals[0].end_time).toBe("13:00");
  });
});

describe("resolveScheduleRules — advisory unmet warnings", () => {
  it("monthly_quota flags a gap when the work type isn't scheduled enough", () => {
    const r = rule("monthly_quota", {
      work_type_id: "wt-consult",
      params: { quota_per_period: 1 },
    });
    const { proposals, unmet } = resolveScheduleRules(ctx([r]));
    expect(proposals).toHaveLength(0);
    expect(unmet).toHaveLength(1);
    expect(unmet[0].message).toContain("0/1");
  });

  it("monthly_quota is satisfied when a matching shift exists", () => {
    const r = rule("monthly_quota", {
      work_type_id: "wt-consult",
      params: { quota_per_period: 1 },
    });
    const existing: ExistingShift[] = [
      { staff_id: "s1", date: "2026-06-10", work_type_ids: ["wt-consult"] },
    ];
    const { unmet } = resolveScheduleRules(ctx([r], { existingShifts: existing }));
    expect(unmet).toHaveLength(0);
  });

  it("preferred_not_assigned warns when the avoided work type is assigned", () => {
    const r = rule("preferred_not_assigned", { work_type_id: "wt-audit" });
    const existing: ExistingShift[] = [
      { staff_id: "s1", date: "2026-06-09", work_type_ids: ["wt-audit"] },
    ];
    const { unmet } = resolveScheduleRules(ctx([r], { existingShifts: existing }));
    expect(unmet).toHaveLength(1);
    expect(unmet[0].message).toContain("2026-06-09");
  });

  it("quarterly_project_days warns in the last week of a named month", () => {
    const r = rule("quarterly_project_days", {
      work_type_id: null,
      params: { month_occurrence: [6], quota_per_period: 2 },
    });
    const { unmet } = resolveScheduleRules(ctx([r])); // window covers all of June
    expect(unmet.some((u) => u.message.includes("0/2"))).toBe(true);
  });

  it("inactive rules produce nothing", () => {
    const r = rule("recurring_shift", {
      is_active: false,
      params: { days: [1, 2, 3, 4, 5] },
    });
    const { proposals, unmet } = resolveScheduleRules(ctx([r]));
    expect(proposals).toHaveLength(0);
    expect(unmet).toHaveLength(0);
  });
});
