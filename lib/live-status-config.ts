// Single source of truth for live-board statuses.
//
// The status VALUES are a fixed enum (live_status_value) — tenants can hide,
// rename, or change whether each counts toward the ratio, but cannot invent new
// ones. A tenant with no live_status_config rows behaves exactly like the
// original hardcoded set: "Working" counts, everything else doesn't. This file
// is the only place the built-in defaults live; the picker, the board, and the
// alert engine all read from here so they can never drift.

import type { LiveStatusConfig, LiveStatusValue } from "@/lib/types";

export interface ResolvedStatus {
  value: LiveStatusValue;
  label: string;
  enabled: boolean;
  counts: boolean;
}

export const BUILTIN_STATUSES: {
  value: LiveStatusValue;
  label: string;
  counts: boolean;
}[] = [
  { value: "present_counting", label: "Working", counts: true },
  { value: "on_lunch", label: "Lunch", counts: false },
  { value: "in_meeting", label: "Meeting", counts: false },
  { value: "off_floor", label: "Off floor", counts: false },
  { value: "non_tech_function", label: "Non-tech", counts: false },
];

/** "Working" is always shown and always counts — it's the default fallback
 *  status, so disabling it or making it non-counting would be incoherent. */
export const LOCKED_STATUS: LiveStatusValue = "present_counting";

/** Overlay a tenant's config rows on the built-in defaults. */
export function resolveStatuses(rows: LiveStatusConfig[]): ResolvedStatus[] {
  const byStatus = new Map(rows.map((r) => [r.status, r]));
  return BUILTIN_STATUSES.map((b) => {
    const row = byStatus.get(b.value);
    const locked = b.value === LOCKED_STATUS;
    return {
      value: b.value,
      label: row?.label?.trim() ? row.label.trim() : b.label,
      enabled: locked ? true : row ? row.enabled : true,
      counts: locked ? true : row ? row.counts_toward_ratio : b.counts,
    };
  });
}

/** value → counts-toward-ratio, for the board/cron counting decision. */
export function countsByStatus(rows: LiveStatusConfig[]): Record<string, boolean> {
  const out: Record<string, boolean> = {};
  for (const s of resolveStatuses(rows)) out[s.value] = s.counts;
  return out;
}

/** value → display label (covers every status, even hidden ones, so a legacy
 *  live_status row still renders a name). */
export function labelByStatus(rows: LiveStatusConfig[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of resolveStatuses(rows)) out[s.value] = s.label;
  return out;
}
