import { describe, expect, it } from "vitest";
import { evaluateConstraints } from "../constraints";
import type { ConstraintRule } from "@/lib/types";
import type { EngineSegment, EngineStaff } from "../types";

const maria: EngineStaff = { id: "st1", full_name: "Maria", ratio_type: "technician" };

function seg(date: string, start = "08:00", end = "16:00"): EngineSegment {
  return {
    shift_id: `s-${date}`,
    zone_id: null,
    date,
    start_time: start,
    end_time: end,
    staff: maria,
    work_type: null,
    counts_override: null,
  };
}

function rule(
  rule_type: ConstraintRule["rule_type"],
  params: Record<string, unknown>,
  overrides: Partial<ConstraintRule> = {}
): ConstraintRule {
  return {
    id: `r-${rule_type}`,
    tenant_id: "t1",
    scope_type: "staff",
    scope_id: "st1",
    rule_type,
    params,
    effective_start: "2026-01-01",
    effective_end: null,
    active: true,
    created_at: "",
    ...overrides,
  };
}

describe("evaluateConstraints", () => {
  it("hour_cap flags a week over the cap", () => {
    // Mon-Fri 8h = 40h, cap 32
    const segs = ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19"].map(
      (d) => seg(d)
    );
    const flags = evaluateConstraints([rule("hour_cap", { hours: 32, period: "week" })], segs);
    expect(flags).toHaveLength(1);
    expect(flags[0].message).toContain("40.0 hours");
  });

  it("overtime flags over the threshold, default 40", () => {
    const segs = ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20"].map(
      (d) => seg(d)
    );
    const flags = evaluateConstraints([rule("overtime", {})], segs);
    expect(flags).toHaveLength(1);
    expect(flags[0].rule_type).toBe("overtime");
  });

  it("always_off flags weekend shifts", () => {
    const flags = evaluateConstraints(
      [rule("always_off", { days: ["sat", "sun"] })],
      [seg("2026-06-20"), seg("2026-06-17")] // Sat + Wed
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].date).toBe("2026-06-20");
  });

  it("hard_stop flags a shift past the stop time", () => {
    const flags = evaluateConstraints(
      [rule("hard_stop", { time: "17:00", days: ["mon", "tue", "wed", "thu", "fri"] })],
      [seg("2026-06-15", "10:00", "19:00"), seg("2026-06-16", "08:00", "16:00")]
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].message).toContain("19:00");
  });

  it("unavailable_window flags overlap only", () => {
    const flags = evaluateConstraints(
      [
        rule("unavailable_window", {
          days: ["mon"],
          time_range: { start: "14:00", end: "18:00" },
        }),
      ],
      [seg("2026-06-15", "08:00", "13:00"), seg("2026-06-15", "12:00", "20:00")]
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].message).toContain("14:00–18:00");
  });

  it("max_consecutive_days flags long streaks", () => {
    const dates = ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18", "2026-06-19", "2026-06-20", "2026-06-21"];
    const flags = evaluateConstraints(
      [rule("max_consecutive_days", { max_days: 6 })],
      dates.map((d) => seg(d))
    );
    expect(flags).toHaveLength(1);
    expect(flags[0].message).toContain("7 consecutive");
  });

  it("rules outside their effective range do not fire", () => {
    const flags = evaluateConstraints(
      [rule("always_off", { days: ["mon"] }, { effective_start: "2026-07-01" })],
      [seg("2026-06-15")]
    );
    expect(flags).toHaveLength(0);
  });

  it("role-scoped rules hit everyone of that ratio type", () => {
    const flags = evaluateConstraints(
      [
        rule("overtime", { threshold_hours: 30 }, { scope_type: "role", scope_id: "technician" }),
      ],
      ["2026-06-15", "2026-06-16", "2026-06-17", "2026-06-18"].map((d) => seg(d))
    );
    expect(flags).toHaveLength(1);
  });
});
