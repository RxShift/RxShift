// Engine input/output shapes. The engines are pure functions over plain
// objects — no database access — so they can be unit-tested exhaustively.
// Calling code maps DB rows into these.

import type { RatioType, CountsAs } from "@/lib/types";

export interface EngineStaff {
  id: string;
  full_name: string;
  ratio_type: RatioType;
  /** Technician in training — counts toward the R072-25 2-trainee sublimit. */
  is_trainee?: boolean;
  /** CPhT — under Tennessee rules, certified techs are uncapped. */
  certified?: boolean;
}

export interface EngineWorkType {
  id: string;
  name: string;
  counts_as: CountsAs;
  counting_default: boolean;
}

/** One scheduled block of work, already joined to its staff + work type. */
export interface EngineSegment {
  shift_id: string;
  /** Ratio is computed per LOCATION — all counting staff at a location count together. */
  location_id: string;
  date: string; // shift date yyyy-mm-dd; segment may spill into the next day
  start_time: string; // "HH:mm"
  end_time: string; // "HH:mm"; end <= start means it crosses midnight
  staff: EngineStaff;
  work_type: EngineWorkType | null;
  counts_override: boolean | null; // segment-level override, null = default
  /**
   * The parent SHIFT's unpaid break minutes (same value on every segment of
   * the shift). Subtracted ONCE per shift in paid-hours math (hour caps,
   * overtime). Never affects ratio coverage — the person is still on site.
   */
  break_minutes?: number;
}

export interface EngineRatioRule {
  max_techs_per_pharmacist: number;
  /** 'flat' (default): P × cap. 'additive' (California BPC 4115):
   *  first + (P−1) × additional — e.g. 2P−1 with first=1, additional=2. */
  formula?: "flat" | "additive";
  additive_first_techs?: number | null;
  additive_additional_techs?: number | null;
  // ── R072-25 (set by toEngineRule when the toggle is on for a retail NV location) ──
  /** Max technicians-in-training per pharmacist (the "2 techs + 2 trainees" sublimit). */
  max_trainees_per_pharmacist?: number | null;
  /** Minimum support staff required when exactly ONE pharmacist is on duty
   *  (Sec 2.3): 1 (no drive-through) or 2 (drive-through). null = no floor. */
  floor_min_support?: number | null;
  // ── Tennessee ──
  /** When true (TN), certified (CPhT) techs do NOT count toward the ceiling;
   *  the cap applies only to non-certified techs. */
  certified_uncapped?: boolean;
}

export interface SlotEval {
  /** Minutes from midnight, e.g. 480 = 08:00 */
  slot_start: number;
  slot_minutes: number;
  pharmacists: string[]; // names on duty and counting
  techs_counting: string[];
  techs_present_non_counting: { name: string; function: string }[];
  status: "compliant" | "deficient";
  deficiency_reason: string | null;
  /** ceiling = too many techs; floor = too few for a solo pharmacist; both. */
  flag_type?: "ceiling" | "floor" | "both" | null;
}

/** date → ordered slot evaluations (only slots with any presence) */
export type DayEvals = Map<string, SlotEval[]>;

export interface ConstraintFlag {
  rule_id: string;
  rule_type: string;
  staff_id: string;
  staff_name: string;
  shift_id: string | null;
  date: string | null;
  message: string;
}
