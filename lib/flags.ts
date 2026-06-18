// One vocabulary for "flags" across RxShift.
//
// A FLAG is a proactive compliance warning of one of exactly two kinds:
//   • "ratio"      — a slot is non-compliant, or at the ratio limit
//                    (from the ratio engine: a deficient SlotEval).
//   • "constraint" — an hours / availability / scheduling-rule issue
//                    (hour caps, rest periods, double-booking, blocked time…).
// Both are surfaced the same way everywhere — the schedule grid, the dashboard,
// the Live Board, and the compliance record — and clicking one navigates to
// where it can be seen and fixed: the schedule, anchored to the offending
// week (+ location for ratio flags). Keep this the single source of the
// definition and the link targets so wording + behavior stay consistent.
//
// Pure module (no server-only) so server components, client components, and
// the engine layer can all share the link/label helpers.

import type { ConstraintFlag } from "@/lib/engine/types";
import type { RatioFlagOut, ValidationOut } from "@/lib/schedule-data";

export type FlagKind = "ratio" | "constraint";

/** Build a deep link into the schedule, anchored to a week + (optional) location. */
export function scheduleHref(opts: {
  location?: string | null;
  anchor?: string | null;
  view?: "week" | "2week" | "month";
}): string {
  const params = new URLSearchParams({ view: opts.view ?? "week" });
  if (opts.location) params.set("location", opts.location);
  if (opts.anchor) params.set("anchor", opts.anchor);
  return `/app/schedule?${params.toString()}`;
}

/** Where a ratio deficiency lives on the schedule (its location + week). */
export function ratioFlagHref(
  f: Pick<RatioFlagOut, "location_id" | "date">
): string {
  return scheduleHref({ location: f.location_id, anchor: f.date });
}

/** Where a constraint flag lives on the schedule (per-person; date if known). */
export function constraintFlagHref(f: Pick<ConstraintFlag, "date">): string {
  return scheduleHref({ anchor: f.date ?? undefined });
}

/** The first ratio deficiency in a validation result, for "jump to it" links. */
export function firstRatioFlag(v: ValidationOut): RatioFlagOut | null {
  return v.ratioFlags[0] ?? null;
}

/** The first constraint flag in a validation result. */
export function firstConstraintFlag(v: ValidationOut): ConstraintFlag | null {
  return v.constraintFlags[0] ?? null;
}
