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
