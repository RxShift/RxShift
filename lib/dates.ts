// Date-string helpers (yyyy-mm-dd). All math is UTC-anchored so a date
// string never shifts across a DST boundary or local timezone.

export function addDaysStr(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function eachDate(start: string, end: string): string[] {
  const out: string[] = [];
  let d = start;
  while (d <= end) {
    out.push(d);
    d = addDaysStr(d, 1);
  }
  return out;
}

export function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Wall-clock "now" in an IANA timezone: local date string + minutes since
 * midnight. Server clocks (UTC on Vercel) must never decide what "today"
 * or "right now" means for a tenant.
 *
 * `overrideMinutes` is a DEMO-ONLY hook: when a number is passed (from a demo
 * tenant's `demo_clock`), the returned minutes are pinned to it while the date
 * stays real — so an after-hours demo still lands inside today's shifts. Real
 * tenants pass nothing and get the true wall clock.
 */
export function nowInTimeZone(
  timeZone: string,
  overrideMinutes?: number | null
): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    // % 24 guards the "24:xx at midnight" quirk in some Intl implementations
    minutes:
      overrideMinutes ?? (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10),
  };
}

/** Parse a demo_clock "HH:MM" into minutes-since-midnight, or null if unset/invalid. */
export function demoClockMinutes(demoClock: string | null | undefined): number | null {
  if (!demoClock || !/^\d{1,2}:\d{2}$/.test(demoClock)) return null;
  const [h, m] = demoClock.split(":").map(Number);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

/** Minutes-since-midnight of an instant in an IANA timezone — used to place a
 *  stored timestamp (e.g. a live-status change) on the tenant's local clock. */
export function minutesInTimeZone(
  instant: Date | string,
  timeZone: string
): number {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(typeof instant === "string" ? new Date(instant) : instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10);
}

/** The local date (yyyy-mm-dd) of an instant in an IANA timezone — used to tell
 *  whether a stored timestamp falls on the tenant's "today". */
export function dateInTimeZone(instant: Date | string, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(typeof instant === "string" ? new Date(instant) : instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function fmtDay(date: string): { dow: string; label: string } {
  const d = new Date(`${date}T00:00:00Z`);
  return {
    dow: DAY_SHORT[d.getUTCDay()],
    label: `${MONTH_SHORT[d.getUTCMonth()]} ${d.getUTCDate()}`,
  };
}

export function fmtRange(start: string, end: string): string {
  const s = fmtDay(start);
  const e = fmtDay(end);
  return `${s.label} – ${e.label}`;
}

/** Period length in days for a cycle starting at a given date. */
export function periodEnd(start: string, cycle: "weekly" | "biweekly" | "monthly"): string {
  if (cycle === "weekly") return addDaysStr(start, 6);
  if (cycle === "biweekly") return addDaysStr(start, 13);
  // monthly: last day of the start month
  const d = new Date(`${start}T00:00:00Z`);
  const last = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
  return last.toISOString().slice(0, 10);
}

/** Natural start for the next period after a given end date. */
export function nextPeriodStart(prevEnd: string): string {
  return addDaysStr(prevEnd, 1);
}

/**
 * Start of the week containing `date`, given the tenant's first day of week
 * (0=Sun … 6=Sat). Generalizes mondayOf so weekly/biweekly periods and the grid
 * align to the tenant's chosen week start. Default 1 = Monday (prior behavior).
 */
export function weekStartOf(date: string, weekStartDay = 1): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  const diff = (dow - weekStartDay + 7) % 7;
  return addDaysStr(date, -diff);
}

/** Monday of the week containing the given date (UTC). Kept for callers that are
 *  intentionally Monday-anchored; configurable callers use weekStartOf. */
export function mondayOf(date: string): string {
  return weekStartOf(date, 1);
}

/** First day of the month containing the given date (yyyy-mm-dd). */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Default first-period start: this week's start day / first of this month. */
export function defaultPeriodStart(
  cycle: "weekly" | "biweekly" | "monthly",
  weekStartDay = 1
): string {
  const now = new Date();
  if (cycle === "monthly") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);
  }
  return weekStartOf(todayStr(), weekStartDay);
}
