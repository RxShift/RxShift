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
 */
export function nowInTimeZone(timeZone: string): { date: string; minutes: number } {
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
    minutes: (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10),
  };
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

/** Monday of the week containing the given date (UTC). */
export function mondayOf(date: string): string {
  const dow = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDaysStr(date, dow === 0 ? -6 : 1 - dow);
}

/** First day of the month containing the given date (yyyy-mm-dd). */
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

/** Default first-period start: this week's Monday / first of this month. */
export function defaultPeriodStart(cycle: "weekly" | "biweekly" | "monthly"): string {
  const now = new Date();
  if (cycle === "monthly") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
      .toISOString()
      .slice(0, 10);
  }
  const today = todayStr();
  const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
  return addDaysStr(today, dow === 0 ? -6 : 1 - dow); // Monday
}
