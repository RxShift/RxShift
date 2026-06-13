// Domain types — mirror supabase/migrations schema (Appendix A of the
// product scoping doc). Keep in sync with the SQL.

export type ScheduleCycle = "weekly" | "biweekly" | "monthly";
export type RatioSlotMinutes = 15 | 30 | 60;
export type RatioType = "pharmacist" | "technician" | "non_counting";
export type EmploymentType =
  | "full_time"
  | "part_time"
  | "per_diem"
  | "contractor_1099";
export type AppRole =
  | "owner_admin"
  | "scheduler"
  | "supervisor"
  | "read_only"
  | "staff";
export type CountsAs = "pharmacist" | "technician" | "none";
export type ShiftStatus = "draft" | "published";
export type RequestStatus = "pending" | "approved" | "denied";
export type SwapStatus =
  | "pending_peer"
  | "pending_manager"
  | "approved"
  | "denied";
export type LiveStatusValue =
  | "present_counting"
  | "on_lunch"
  | "off_floor"
  | "in_meeting"
  | "non_tech_function";
export type ConstraintRuleType =
  | "hour_cap"
  | "overtime"
  | "unavailable_window"
  | "hard_stop"
  | "recurring_unavailable"
  | "always_off"
  | "max_consecutive_days";
export type WarningType = "ratio" | "cap" | "constraint";
export type TenantStatus = "setup" | "trial" | "live";

export interface Tenant {
  id: string;
  name: string;
  timezone: string;
  schedule_cycle: ScheduleCycle;
  ratio_slot_minutes: RatioSlotMinutes;
  has_ratio: boolean;
  branding: { logo_url?: string; primary_color?: string } | null;
  onboarding_complete: boolean;
  /** Kill switch: false = this tenant never sends email (demo/test tenants) */
  outbound_email_enabled: boolean;
  /** Lifecycle: setup/trial tenants only email the allowlist; live sends normally */
  status: TenantStatus;
  /** When non-empty, ONLY these addresses can receive app email (case-insensitive) */
  email_allowlist: string[] | null;
  /** Default unpaid break minutes applied to new shifts of 6+ hours */
  default_break_minutes: number;
  /** Demo tenant: fictional data; email redirected or suppressed, never live */
  is_demo: boolean;
  /** When set on a demo tenant, ALL app email is rewritten to this address */
  demo_redirect_email: string | null;
  // ── Billing scaffold (manual today; Stripe/Chargebee implement the same fields)
  billing_status: "none" | "trial" | "active" | "past_due" | "canceled";
  billing_provider: "manual" | "stripe" | "chargebee" | null;
  billing_external_id: string | null;
  billed_locations: number | null;
  billing_interval: "monthly" | "annual" | null;
  billing_started_at: string | null;
  created_at: string;
}

// ─── Internal CRM (platform-admin only) ──────────────────────────────────────

export type LeadSource = "inbound" | "referral" | "LinkedIn" | "Susie" | "cold";
export type LeadStage = "Lead" | "Demo" | "Trial" | "Active" | "Churned";

export interface Lead {
  id: string;
  pharmacy_name: string;
  location_count: number | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  source: LeadSource;
  stage: LeadStage;
  state: string | null;
  message: string | null;
  source_page: string | null;
  created_at: string;
  updated_at: string;
}

export interface LeadNote {
  id: string;
  lead_id: string;
  author: string;
  body: string;
  created_at: string;
}

export interface Location {
  id: string;
  tenant_id: string;
  name: string;
  address: string | null;
  operating_hours: Record<
    string, // mon..sun
    { open: string; close: string } | null
  > | null;
  timezone_override: string | null;
  created_at: string;
}

export interface RatioZone {
  id: string;
  tenant_id: string;
  location_id: string;
  name: string;
  ratio_isolated: boolean;
  ratio_rule_id: string | null;
  created_at: string;
}

export interface Department {
  id: string;
  tenant_id: string;
  location_id: string;
  name: string;
  created_at: string;
}

export interface Staff {
  id: string;
  tenant_id: string;
  home_location_id: string | null;
  full_name: string;
  login_email: string | null;
  work_email: string | null;
  job_title: string | null;
  ratio_type: RatioType;
  employment_type: EmploymentType;
  /** CPhT national certification — informational + shown in exports */
  certified: boolean;
  active: boolean;
  created_at: string;
}

export interface AppUser {
  id: string;
  supabase_user_id: string;
  staff_id: string | null;
  tenant_id: string;
  role: AppRole;
  scheduler_scope: string[] | null; // department ids
  is_pto_approver: boolean;
  pto_approver_rank: "primary" | "backup" | null;
  created_at: string;
}

export interface WorkType {
  id: string;
  tenant_id: string;
  name: string;
  counts_as: CountsAs;
  counting_default: boolean;
  exclusion_rules: Record<string, unknown> | null;
  is_specialized: boolean;
  color: string | null; // display hex (#RRGGBB); null = neutral
  created_at: string;
}

export interface Shift {
  id: string;
  tenant_id: string;
  location_id: string;
  department_id: string | null;
  ratio_zone_id: string | null;
  staff_id: string;
  date: string; // yyyy-mm-dd
  schedule_period_id: string;
  status: ShiftStatus;
  notes: string | null;
  /** Unpaid break (lunch) — subtracted from paid hours, not from coverage */
  break_minutes: number;
  created_by: string | null;
  created_at: string;
}

export interface ShiftSegment {
  id: string;
  shift_id: string;
  tenant_id: string;
  start_time: string; // HH:mm
  end_time: string; // HH:mm — end <= start means it spills past midnight
  work_type_id: string | null;
  counts_toward_ratio: boolean | null; // null = follow work type default
}

export interface SchedulePeriod {
  id: string;
  tenant_id: string;
  location_id: string;
  cycle: ScheduleCycle;
  start_date: string;
  end_date: string;
  status: ShiftStatus;
  published_at: string | null;
  published_by: string | null;
  created_at: string;
}

export interface TimeOffRequest {
  id: string;
  tenant_id: string;
  staff_id: string;
  start_date: string;
  end_date: string;
  type: string;
  staff_message: string | null;
  status: RequestStatus;
  approver_id: string | null;
  decided_at: string | null;
  created_at: string;
}

export interface Callout {
  id: string;
  tenant_id: string;
  staff_id: string;
  shift_id: string | null;
  reason: string | null;
  logged_at: string;
  resulting_gap: Record<string, unknown> | null;
}

export interface SwapRequest {
  id: string;
  tenant_id: string;
  requesting_staff_id: string;
  counter_staff_id: string;
  shift_a_id: string;
  shift_b_id: string | null;
  status: SwapStatus;
  peer_accepted_at: string | null;
  manager_id: string | null;
  ratio_effect: Record<string, unknown> | null;
  created_at: string;
}

export interface ConstraintRule {
  id: string;
  tenant_id: string;
  scope_type: "staff" | "role";
  scope_id: string; // staff id, or a RatioType when scope_type=role
  rule_type: ConstraintRuleType;
  params: Record<string, unknown>;
  effective_start: string;
  effective_end: string | null;
  active: boolean;
  created_at: string;
}

export type RatioFormula = "flat" | "additive";

export interface RatioRule {
  id: string;
  tenant_id: string | null; // null = global seed
  state: string;
  max_techs_per_pharmacist: number;
  /** 'flat': P × cap. 'additive': first + (P−1) × additional (CA: 2P−1) */
  formula: RatioFormula;
  additive_first_techs: number | null;
  additive_additional_techs: number | null;
  trainee_sublimits: Record<string, unknown> | null;
  composition_rules: Record<string, unknown> | null;
  source_citation: string | null;
  notes: string | null;
}

export interface LiveStatus {
  id: string;
  tenant_id: string;
  staff_id: string;
  status: LiveStatusValue;
  work_type_id: string | null;
  effective_from: string;
  effective_to: string | null;
}

export interface VolumeData {
  id: string;
  tenant_id: string;
  location_id: string;
  date: string;
  hour: number;
  script_count: number;
}

export interface Notification {
  id: string;
  tenant_id: string;
  user_id: string;
  type: string;
  payload: Record<string, unknown>;
  channel: "email" | "in_app";
  read: boolean;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  tenant_id: string;
  actor_user_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  detail: Record<string, unknown> | null;
  created_at: string;
}

export interface OverrideLog {
  id: string;
  tenant_id: string;
  actor_user_id: string;
  target_type: "shift" | "slot";
  target_id: string;
  warning_type: WarningType;
  reason: string;
  created_at: string;
}

export interface HelpArticle {
  id: string;
  slug: string;
  title: string;
  body_markdown: string;
  category: string;
  sort_order: number;
  published: boolean;
  updated_at: string;
}

export interface ComplianceSnapshot {
  id: string;
  tenant_id: string;
  schedule_period_id: string;
  ratio_zone_id: string;
  generated_at: string;
  rows: ComplianceRecordRow[];
}

// Appendix D — one row per (date, hour, zone)
export interface ComplianceRecordRow {
  date: string;
  hour: number;
  zone_id: string;
  zone_name: string;
  pharmacists_on_duty: string[];
  technicians_counting: { name: string; count?: never }[] | string[];
  technicians_count: number;
  technicians_present_non_counting: { name: string; function: string }[];
  ratio_status: "compliant" | "deficient";
  deficiency_reason: string | null;
}
