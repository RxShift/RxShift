// Seed library of common pharmacy work types — offered during onboarding,
// adjustable any time in Settings. Counting defaults follow scoping §5:
// production/dispensing count; inventory, procurement, cleaning, clerical
// do not. All configurable per pharmacy, never baked in.

import type { CountsAs } from "@/lib/types";

export interface WorkTypeSeed {
  name: string;
  counts_as: CountsAs;
  counting_default: boolean;
  is_specialized: boolean;
}

export const WORK_TYPE_SEEDS: WorkTypeSeed[] = [
  { name: "Dispensing", counts_as: "technician", counting_default: true, is_specialized: false },
  { name: "Production", counts_as: "technician", counting_default: true, is_specialized: false },
  { name: "Verification", counts_as: "pharmacist", counting_default: true, is_specialized: false },
  { name: "Counseling", counts_as: "pharmacist", counting_default: true, is_specialized: false },
  { name: "IV Room", counts_as: "technician", counting_default: true, is_specialized: true },
  { name: "Inventory", counts_as: "technician", counting_default: false, is_specialized: false },
  { name: "Procurement", counts_as: "technician", counting_default: false, is_specialized: false },
  { name: "Cleaning", counts_as: "technician", counting_default: false, is_specialized: false },
  { name: "Clerical", counts_as: "technician", counting_default: false, is_specialized: false },
  { name: "Off-floor / Meeting", counts_as: "none", counting_default: false, is_specialized: false },
];

export const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID",
  "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS",
  "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK",
  "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA", "WV",
  "WI", "WY",
] as const;

export const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;
