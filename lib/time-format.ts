// Single source of truth for rendering a time of day (and a timestamp) in the
// tenant's chosen format. Before this, three inline helpers disagreed —
// shift-block.tsx showed 24h, scheduling-rules-display.ts showed 12h AM/PM, and
// My Schedule showed a compact 12h — and timestamps used the browser locale.
// Everything now flows through here so a tenant's "12h vs military" toggle is
// consistent on every surface.
//
// Deliberately NO "server-only" import: the reports layer + the tsx-safe engine
// helpers call these too, exactly like lib/dates.ts and lib/engine/*.

import { dateInTimeZone, minutesInTimeZone } from "@/lib/dates";
import type { TimeFormat } from "@/lib/types";

const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/** Parse "HH:MM" (or "HH:MM:SS") into {h, m}, or null if empty/invalid. */
function parseHm(t?: string | null): { h: number; m: number } | null {
  if (!t || !/^\d{1,2}:\d{2}/.test(t)) return null;
  const [h, m] = t.slice(0, 5).split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m) || h > 24 || m > 59) return null;
  return { h: h % 24, m };
}

/**
 * A time of day for display.
 *   "12h" → "9:00 AM", "12:00 PM", "5:30 PM", "12:00 AM"
 *   "24h" → "09:00", "12:00", "17:30", "00:00"
 * Empty/invalid input → "".
 */
export function formatTime(t: string | null | undefined, fmt: TimeFormat): string {
  const hm = parseHm(t);
  if (!hm) return "";
  const { h, m } = hm;
  if (fmt === "24h") {
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  }
  const ap = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${ap}`;
}

/**
 * A compact time of day for tight mobile cells.
 *   "12h" → "9a", "9:30a", "5p", "5:30p", "12p" (noon), "12a" (midnight)
 *   "24h" → "9", "9:30", "17", "17:30" (no am/pm marker)
 * Empty/invalid input → "".
 */
export function formatTimeCompact(
  t: string | null | undefined,
  fmt: TimeFormat
): string {
  const hm = parseHm(t);
  if (!hm) return "";
  const { h, m } = hm;
  if (fmt === "24h") {
    return m ? `${h}:${String(m).padStart(2, "0")}` : String(h);
  }
  const ap = h < 12 ? "a" : "p";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, "0")}${ap}` : `${h12}${ap}`;
}

/** A start–end range, e.g. "9:00 AM – 5:00 PM" or "09:00 – 17:00". */
export function formatTimeRange(
  start: string | null | undefined,
  end: string | null | undefined,
  fmt: TimeFormat
): string {
  const s = formatTime(start, fmt);
  const e = formatTime(end, fmt);
  if (!s && !e) return "";
  return `${s} – ${e}`;
}

/**
 * A stored instant (ISO string) rendered as a human timestamp in the tenant's
 * timezone + hour format — e.g. "Jun 30, 2026, 4:05 PM" or "Jun 30, 2026, 16:05".
 * Replaces browser-locale `toLocaleString()` on audit / compliance / request views
 * so the "when it happened" reads the same for every viewer regardless of their
 * machine's locale or timezone. Pass tenant.timezone + tenant.time_format.
 */
export function formatTimestamp(
  iso: string | null | undefined,
  timezone: string,
  fmt: TimeFormat
): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const localDate = dateInTimeZone(d, timezone); // yyyy-mm-dd in tenant tz
  const [y, mo, day] = localDate.split("-").map(Number);
  const minutes = minutesInTimeZone(d, timezone);
  const timeStr = formatTime(
    `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`,
    fmt
  );
  const dow = new Date(`${localDate}T00:00:00Z`).getUTCDay();
  return `${DAY_SHORT[dow]}, ${MONTH_SHORT[mo - 1]} ${day}, ${y}, ${timeStr}`;
}

/** An hour-of-day bucket label, e.g. "9:00 AM–10:00 AM" or "09:00–10:00". */
export function formatHourRange(hour: number, fmt: TimeFormat): string {
  const at = (h: number) => formatTime(`${String(h % 24).padStart(2, "0")}:00`, fmt);
  return `${at(hour)}–${at(hour + 1)}`;
}
