// Deterministic US federal holiday generator — pure date math, NO network or AI.
// Returns the OBSERVED date (the weekday a fixed-date holiday is observed when it
// lands on a weekend), which is what a pharmacy actually observes — e.g. July 4,
// 2026 falls on a Saturday, so Independence Day is observed Friday, July 3.
//
// Not `server-only`, so the demo seed can reuse it. The Settings → Holidays page
// generates from this, then a scheduler can freely add / remove / edit.

export interface GeneratedHoliday {
  date: string; // yyyy-mm-dd
  name: string;
}

function ymd(year: number, month1: number, day: number): string {
  return `${year}-${String(month1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Day of week for a yyyy-mm-dd: 0=Sun..6=Sat (UTC, no timezone drift). */
function dowOf(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

/** The nth (1-based) given weekday of a month. weekday: 0=Sun..6=Sat. */
function nthWeekday(
  year: number,
  month1: number,
  weekday: number,
  n: number
): string {
  const first = new Date(Date.UTC(year, month1 - 1, 1)).getUTCDay();
  const offset = (weekday - first + 7) % 7;
  return ymd(year, month1, 1 + offset + (n - 1) * 7);
}

/** The last given weekday of a month. */
function lastWeekday(year: number, month1: number, weekday: number): string {
  const lastDay = new Date(Date.UTC(year, month1, 0)).getUTCDate();
  const lastDow = new Date(Date.UTC(year, month1 - 1, lastDay)).getUTCDay();
  return ymd(year, month1, lastDay - ((lastDow - weekday + 7) % 7));
}

/** Federal "in lieu of" observance: Saturday → prior Friday, Sunday → next Monday. */
function observed(dateStr: string): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay();
  if (dow === 6) date.setUTCDate(date.getUTCDate() - 1);
  else if (dow === 0) date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}

/** The 11 US federal holidays for a year, on their OBSERVED dates, sorted. */
export function usFederalHolidays(year: number): GeneratedHoliday[] {
  return [
    { date: observed(ymd(year, 1, 1)), name: "New Year's Day" },
    { date: nthWeekday(year, 1, 1, 3), name: "Martin Luther King Jr. Day" },
    { date: nthWeekday(year, 2, 1, 3), name: "Presidents' Day" },
    { date: lastWeekday(year, 5, 1), name: "Memorial Day" },
    { date: observed(ymd(year, 6, 19)), name: "Juneteenth" },
    { date: observed(ymd(year, 7, 4)), name: "Independence Day" },
    { date: nthWeekday(year, 9, 1, 1), name: "Labor Day" },
    { date: nthWeekday(year, 10, 1, 2), name: "Columbus Day" },
    { date: observed(ymd(year, 11, 11)), name: "Veterans Day" },
    { date: nthWeekday(year, 11, 4, 4), name: "Thanksgiving Day" },
    { date: observed(ymd(year, 12, 25)), name: "Christmas Day" },
  ].sort((a, b) => a.date.localeCompare(b.date));
}
