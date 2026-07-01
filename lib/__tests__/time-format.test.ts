import { describe, expect, it } from "vitest";
import {
  formatTime,
  formatTimeCompact,
  formatTimeRange,
  formatHourRange,
  formatTimestamp,
} from "../time-format";

describe("formatTime", () => {
  it("12h: renders AM/PM with minutes", () => {
    expect(formatTime("09:00", "12h")).toBe("9:00 AM");
    expect(formatTime("17:30", "12h")).toBe("5:30 PM");
  });
  it("12h: midnight and noon read correctly", () => {
    expect(formatTime("00:00", "12h")).toBe("12:00 AM");
    expect(formatTime("12:00", "12h")).toBe("12:00 PM");
    expect(formatTime("00:30", "12h")).toBe("12:30 AM");
  });
  it("24h: zero-padded, no AM/PM", () => {
    expect(formatTime("09:00", "24h")).toBe("09:00");
    expect(formatTime("17:30", "24h")).toBe("17:30");
    expect(formatTime("00:00", "24h")).toBe("00:00");
  });
  it("tolerates a seconds suffix", () => {
    expect(formatTime("08:15:00", "12h")).toBe("8:15 AM");
    expect(formatTime("08:15:00", "24h")).toBe("08:15");
  });
  it("empty/invalid → empty string", () => {
    expect(formatTime("", "12h")).toBe("");
    expect(formatTime(null, "24h")).toBe("");
    expect(formatTime(undefined, "12h")).toBe("");
    expect(formatTime("nope", "12h")).toBe("");
  });
});

describe("formatTimeCompact", () => {
  it("12h: single-letter marker; drops :00", () => {
    expect(formatTimeCompact("08:00", "12h")).toBe("8a");
    expect(formatTimeCompact("17:30", "12h")).toBe("5:30p");
    expect(formatTimeCompact("12:00", "12h")).toBe("12p");
    expect(formatTimeCompact("00:00", "12h")).toBe("12a");
  });
  it("24h: no marker; drops :00", () => {
    expect(formatTimeCompact("08:00", "24h")).toBe("8");
    expect(formatTimeCompact("17:30", "24h")).toBe("17:30");
  });
});

describe("formatTimeRange", () => {
  it("joins start and end with an en dash", () => {
    expect(formatTimeRange("09:00", "17:00", "12h")).toBe("9:00 AM – 5:00 PM");
    expect(formatTimeRange("09:00", "17:00", "24h")).toBe("09:00 – 17:00");
  });
  it("empty when both sides are blank", () => {
    expect(formatTimeRange("", "", "12h")).toBe("");
  });
});

describe("formatHourRange", () => {
  it("labels an hour bucket in each format", () => {
    expect(formatHourRange(9, "12h")).toBe("9:00 AM–10:00 AM");
    expect(formatHourRange(9, "24h")).toBe("09:00–10:00");
    expect(formatHourRange(23, "24h")).toBe("23:00–00:00");
  });
});

describe("formatTimestamp", () => {
  it("renders an instant in the tenant tz + chosen hour format", () => {
    // 2026-06-30T23:05:00Z → 4:05 PM Pacific (UTC-7 in summer), same calendar day.
    const iso = "2026-06-30T23:05:00Z";
    expect(formatTimestamp(iso, "America/Los_Angeles", "12h")).toBe(
      "Tue, Jun 30, 2026, 4:05 PM"
    );
    expect(formatTimestamp(iso, "America/Los_Angeles", "24h")).toBe(
      "Tue, Jun 30, 2026, 16:05"
    );
  });
  it("empty/invalid → empty string", () => {
    expect(formatTimestamp("", "America/Los_Angeles", "12h")).toBe("");
    expect(formatTimestamp(null, "UTC", "24h")).toBe("");
  });
});
