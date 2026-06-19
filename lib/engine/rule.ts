// Pure mapping from the stored ratio_rule (+ per-location context) to the engine
// rule, applying the state/location overlays. Lives in the engine (no DB, no
// server-only) so BOTH the server path (lib/schedule-data) and the tsx-safe
// finalizer (lib/compliance-record) use ONE implementation — they can't drift.

import type { EngineRatioRule } from "./types";

export interface RuleContext {
  locationType?: "retail" | "telepharmacy" | "institutional";
  hasDriveThrough?: boolean;
  /** tenant.nevada_r072_25 */
  r072Enabled?: boolean;
}

/** The subset of a stored ratio_rule the overlay needs. */
export interface StoredRatioRule {
  state: string;
  max_techs_per_pharmacist: number;
  formula?: "flat" | "additive" | null;
  additive_first_techs?: number | null;
  additive_additional_techs?: number | null;
}

/**
 * Apply the regulatory overlays:
 *  • Tennessee (state 'TN'): certified techs are uncapped (cap applies to
 *    non-certified only).
 *  • Nevada R072-25 (toggle on + state 'NV' + retail location): 4-tech ceiling,
 *    2-trainee sublimit, and the solo-pharmacist staffing floor (1, or 2 with a
 *    drive-through). Telepharmacy/institutional and toggle-off keep the stored cap.
 * With no ctx this returns the pre-R072-25 behavior unchanged.
 */
export function buildEngineRule(
  rule: StoredRatioRule,
  ctx?: RuleContext
): EngineRatioRule {
  const isRetail = (ctx?.locationType ?? "retail") === "retail";
  const tn = rule.state === "TN";
  const r072 = !!ctx?.r072Enabled && rule.state === "NV" && isRetail;

  let maxTechs = rule.max_techs_per_pharmacist;
  let maxTrainees: number | null = null;
  let floor: number | null = null;
  if (r072) {
    maxTechs = 4;
    maxTrainees = 2;
    floor = ctx?.hasDriveThrough ? 2 : 1;
  }

  return {
    max_techs_per_pharmacist: maxTechs,
    formula: rule.formula ?? undefined,
    additive_first_techs: rule.additive_first_techs,
    additive_additional_techs: rule.additive_additional_techs,
    max_trainees_per_pharmacist: maxTrainees,
    floor_min_support: floor,
    certified_uncapped: tn,
  };
}
