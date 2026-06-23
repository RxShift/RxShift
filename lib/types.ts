// Domain types — mirror supabase/migrations schema (Appendix A of the
// product scoping doc). Keep in sync with the SQL.

export type ScheduleCycle = "weekly" | "biweekly" | "monthly";
export type RatioSlotMinutes = 15 | 30 | 60;
export type RatioType = "pharmacist" | "technician" | "non_counting";
/** Role classification (distinct from RatioType, which is how a person COUNTS).
 *  Adds the technician-in-training distinction R072-25 needs for the sublimit. */
export type StaffType = "pharmacist" | "tech" | "tech_in_training";
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
  /**
   * Demo-only "pretend it's this time of day" override ("HH:MM"). When set, the
   * live board / My Schedule / live status evaluate "now" at this time on the
   * real (tenant-tz) date, so after-hours demos still show staff on shift. Real
   * tenants leave this null and always use the real clock.
   */
  demo_clock: string | null;
  /** When true, every shift must be assigned a department */
  require_department: boolean;
  /** When true, a reason is required to save any PTO (request or scheduler-entered) */
  pto_reason_required: boolean;
  /** Nevada R072-25 (proposed, not adopted): when on, retail locations use the
   *  4-tech ceiling + 2-trainee sublimit + the solo-pharmacist staffing floor. */
  nevada_r072_25: boolean;
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

// ─── Email log (platform-admin only) ─────────────────────────────────────────
// Every email the app sends flows through the single sendEmail() core, which
// writes one row here. tenant_id is null for auth/sign-in links and the public
// demo form. Stores the rendered HTML so an admin can view the actual email.
export type EmailKind =
  | "notification"
  | "auth"
  | "demo_request"
  | "feedback"
  | "system";
export type EmailStatus =
  | "sent"
  | "suppressed"
  | "redirected"
  | "failed"
  | "delivered"
  | "bounced"
  | "complained";

export interface EmailLog {
  id: string;
  tenant_id: string | null;
  kind: EmailKind;
  to_email: string;
  from_email: string;
  subject: string;
  body_html: string | null;
  status: EmailStatus;
  redirected_to: string | null;
  provider_message_id: string | null;
  error: string | null;
  related_type: string | null;
  related_id: string | null;
  actor_user_id: string | null;
  created_at: string;
}

// ─── Feedback / issues (platform-admin managed) ──────────────────────────────
// One inbox for user-submitted feedback/bugs/features AND system-detected
// problems (source='system', e.g. a failed send or a bounce).
export type FeedbackSource = "user" | "system";
export type FeedbackKind = "bug" | "feature" | "feedback";
export type FeedbackStatus =
  | "new"
  | "triaged"
  | "in_progress"
  | "done"
  | "wont_do";

export interface Feedback {
  id: string;
  tenant_id: string | null;
  actor_user_id: string | null;
  staff_id: string | null;
  source: FeedbackSource;
  kind: FeedbackKind;
  subject: string;
  body: string | null;
  screenshot_path: string | null;
  page_url: string | null;
  status: FeedbackStatus;
  internal_note: string | null;
  created_at: string;
  updated_at: string;
}

export type LocationType = "retail" | "telepharmacy" | "institutional";

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
  /** R072-25: retail non-institutional gets the 4-tech ceiling/floor; others 3 */
  location_type: LocationType;
  has_drive_through: boolean;
  /** Expected daily Rx volume per weekday — informational (no enforcement) */
  expected_rx_mon: number | null;
  expected_rx_tue: number | null;
  expected_rx_wed: number | null;
  expected_rx_thu: number | null;
  expected_rx_fri: number | null;
  expected_rx_sat: number | null;
  expected_rx_sun: number | null;
  created_at: string;
}

// Departments are tenant-level groupings (front counter, compounding, hospice).
// They do NOT affect ratio — ratio is computed per LOCATION. A department can be
// used at any location; it's an optional tag on a shift, for filtering/pivoting.
export interface Department {
  id: string;
  tenant_id: string;
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
  /** Role classification; adds tech-in-training. ratio_type still drives counting. */
  staff_type: StaffType;
  employment_type: EmploymentType;
  /** CPhT national certification — drives the Tennessee certified-uncapped ceiling */
  certified: boolean;
  active: boolean;
  /** Path within the private 'avatars' Storage bucket; null = no photo */
  avatar_path: string | null;
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
  /** Human name for owners/admins not on the staff roster; null = use role/staff */
  display_name: string | null;
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

/**
 * A first-class PTO fact: this person is off on this date. One row per person per
 * date, independent of publish/period state (so future PTO shows before any period
 * exists). Written by time-off approval AND by a scheduler directly. The engine
 * never reads this — PTO affects ratio only via the absence of a shift.
 */
export interface PtoDay {
  id: string;
  tenant_id: string;
  staff_id: string;
  date: string; // yyyy-mm-dd
  reason: string | null;
  created_by: string | null;
  created_at: string;
}

/** A tenant-wide holiday (uniform across locations). Purely visual on the grid —
 *  it tints/labels the column, never blocks staffing. */
export interface Holiday {
  id: string;
  tenant_id: string;
  date: string; // yyyy-mm-dd
  name: string;
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

/** Per-tenant decoration of the fixed live statuses: show/hide, rename, and
 *  whether each counts toward the ratio. No row = built-in default. */
export interface LiveStatusConfig {
  id: string;
  tenant_id: string;
  status: LiveStatusValue;
  enabled: boolean;
  label: string | null;
  counts_toward_ratio: boolean;
  created_at: string;
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
  target_type: "shift" | "slot" | "time_off" | "swap" | "callout";
  target_id: string;
  warning_type: WarningType;
  reason: string;
  created_at: string;
}

/** Append-only annotation on an activity_log entry. The original is never edited. */
export interface ActivityLogNote {
  id: string;
  tenant_id: string;
  activity_log_id: string;
  author_user_id: string | null;
  note: string;
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
  location_id: string;
  generated_at: string;
  rows: ComplianceRecordRow[];
}

// Appendix D — one row per (date, hour, location)
export interface ComplianceRecordRow {
  date: string;
  hour: number;
  location_id: string;
  location_name: string;
  pharmacists_on_duty: string[];
  technicians_counting: { name: string; count?: never }[] | string[];
  technicians_count: number;
  technicians_present_non_counting: { name: string; function: string }[];
  ratio_status: "compliant" | "deficient";
  deficiency_reason: string | null;
  /** Whether a deficiency is over the ceiling (too many techs), under the floor
   *  (too few staff for a solo pharmacist), or both. Null when compliant. */
  flag_type?: "ceiling" | "floor" | "both" | null;
}

// The Compliance Record (as-worked): an IMMUTABLE, frozen-once-the-hour-passes
// row of what ACTUALLY happened (schedule adjusted by live-status history).
// Distinct from the publish-time ComplianceSnapshot (the as-scheduled plan).
export interface ComplianceRecord {
  id: string;
  tenant_id: string;
  location_id: string;
  date: string; // yyyy-mm-dd
  hour: number; // 0–23 (tenant tz)
  ratio_status: "compliant" | "deficient";
  deficiency_reason: string | null;
  flag_type: "ceiling" | "floor" | "both" | null;
  required_max_techs: number | null;
  detail: ComplianceRecordRow;
  recorded_at: string;
}

// Append-only annotation on a compliance_record hour (mirrors ActivityLogNote).
// The determination never changes; a note adds after-the-fact context.
export interface ComplianceRecordNote {
  id: string;
  tenant_id: string;
  compliance_record_id: string;
  author_user_id: string | null;
  note: string;
  created_at: string;
}
