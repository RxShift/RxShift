// Engine input/output shapes. The engines are pure functions over plain
// objects — no database access — so they can be unit-tested exhaustively.
// Calling code maps DB rows into these.

import type { RatioType, CountsAs } from "@/lib/types";

export interface EngineStaff {
  id: string;
  full_name: string;
  ratio_type: RatioType;
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
  zone_id: string | null;
  date: string; // shift date yyyy-mm-dd; segment may spill into the next day
  start_time: string; // "HH:mm"
  end_time: string; // "HH:mm"; end <= start means it crosses midnight
  staff: EngineStaff;
  work_type: EngineWorkType | null;
  counts_override: boolean | null; // segment-level override, null = default
}

export interface EngineRatioRule {
  max_techs_per_pharmacist: number;
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
}

/** date → ordered slot evaluations (only slots with any presence) */
export type ZoneDayEvals = Map<string, SlotEval[]>;

export interface ConstraintFlag {
  rule_id: string;
  rule_type: string;
  staff_id: string;
  staff_name: string;
  shift_id: string | null;
  date: string | null;
  message: string;
}
