-- RxShift v1 schema — per RxShift-Product-Scoping.md Appendix A.
-- Every tenant table carries tenant_id and is protected by RLS (0002).
-- help_article and the global ratio_rule seeds are global content.

create extension if not exists "pgcrypto";

-- ─── Enums ─────────────────────────────────────────────────────────────────

create type schedule_cycle as enum ('weekly', 'biweekly', 'monthly');
create type ratio_type as enum ('pharmacist', 'technician', 'non_counting');
create type employment_type as enum ('full_time', 'part_time', 'per_diem', 'contractor_1099');
create type app_role as enum ('owner_admin', 'scheduler', 'supervisor', 'read_only', 'staff');
create type counts_as as enum ('pharmacist', 'technician', 'none');
create type shift_status as enum ('draft', 'published');
create type request_status as enum ('pending', 'approved', 'denied');
create type swap_status as enum ('pending_peer', 'pending_manager', 'approved', 'denied');
create type live_status_value as enum ('present_counting', 'on_lunch', 'off_floor', 'in_meeting', 'non_tech_function');
create type constraint_rule_type as enum ('hour_cap', 'overtime', 'unavailable_window', 'hard_stop', 'recurring_unavailable', 'always_off', 'max_consecutive_days');
create type warning_type as enum ('ratio', 'cap', 'constraint');
create type notification_channel as enum ('email', 'in_app');
create type pto_approver_rank as enum ('primary', 'backup');
create type constraint_scope as enum ('staff', 'role');

-- ─── Core org ──────────────────────────────────────────────────────────────

create table tenant (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  timezone text not null default 'America/Los_Angeles',
  schedule_cycle schedule_cycle not null default 'weekly',
  ratio_slot_minutes int not null default 30 check (ratio_slot_minutes in (15, 30, 60)),
  has_ratio boolean not null default false,
  branding jsonb,
  onboarding_complete boolean not null default false,
  created_at timestamptz not null default now()
);

create table location (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  name text not null,
  address text,
  operating_hours jsonb,
  timezone_override text,
  created_at timestamptz not null default now()
);

create table ratio_rule (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenant(id) on delete cascade, -- null = global seed
  state text not null,
  max_techs_per_pharmacist int not null,
  trainee_sublimits jsonb,
  composition_rules jsonb,
  source_citation text,
  notes text
);

create table ratio_zone (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  name text not null,
  ratio_isolated boolean not null default false,
  ratio_rule_id uuid references ratio_rule(id) on delete set null,
  created_at timestamptz not null default now()
);

create table department (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

-- ─── People ────────────────────────────────────────────────────────────────

create table staff (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  home_location_id uuid references location(id) on delete set null,
  full_name text not null,
  login_email text,
  work_email text,
  job_title text,
  ratio_type ratio_type not null default 'technician',
  employment_type employment_type not null default 'full_time',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table staff_location (
  staff_id uuid not null references staff(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  tenant_id uuid not null references tenant(id) on delete cascade,
  is_home boolean not null default false,
  primary key (staff_id, location_id)
);

create table app_user (
  id uuid primary key default gen_random_uuid(),
  supabase_user_id uuid not null unique,
  staff_id uuid references staff(id) on delete set null,
  tenant_id uuid not null references tenant(id) on delete cascade,
  role app_role not null default 'staff',
  scheduler_scope uuid[],
  is_pto_approver boolean not null default false,
  pto_approver_rank pto_approver_rank,
  created_at timestamptz not null default now()
);

-- ─── Work types & schedule ─────────────────────────────────────────────────

create table work_type (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  name text not null,
  counts_as counts_as not null default 'none',
  counting_default boolean not null default false,
  exclusion_rules jsonb,
  is_specialized boolean not null default false,
  created_at timestamptz not null default now()
);

create table schedule_period (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  cycle schedule_cycle not null,
  start_date date not null,
  end_date date not null,
  status shift_status not null default 'draft',
  published_at timestamptz,
  published_by uuid,
  created_at timestamptz not null default now()
);

create table shift (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  department_id uuid references department(id) on delete set null,
  ratio_zone_id uuid references ratio_zone(id) on delete set null,
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  schedule_period_id uuid not null references schedule_period(id) on delete cascade,
  status shift_status not null default 'draft',
  notes text,
  created_by uuid,
  created_at timestamptz not null default now()
);

create table shift_segment (
  id uuid primary key default gen_random_uuid(),
  shift_id uuid not null references shift(id) on delete cascade,
  tenant_id uuid not null references tenant(id) on delete cascade,
  start_time time not null,
  end_time time not null, -- end <= start means the segment crosses midnight
  work_type_id uuid references work_type(id) on delete set null,
  counts_toward_ratio boolean -- null = follow work type default
);

-- ─── Requests & absences ───────────────────────────────────────────────────

create table time_off_request (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  start_date date not null,
  end_date date not null,
  type text not null default 'pto',
  staff_message text,
  status request_status not null default 'pending',
  approver_id uuid,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);

create table callout (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  shift_id uuid references shift(id) on delete set null,
  reason text,
  logged_at timestamptz not null default now(),
  resulting_gap jsonb
);

create table swap_request (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  requesting_staff_id uuid not null references staff(id) on delete cascade,
  counter_staff_id uuid not null references staff(id) on delete cascade,
  shift_a_id uuid not null references shift(id) on delete cascade,
  shift_b_id uuid references shift(id) on delete cascade,
  status swap_status not null default 'pending_peer',
  peer_accepted_at timestamptz,
  manager_id uuid,
  ratio_effect jsonb,
  created_at timestamptz not null default now()
);

-- ─── Rules ─────────────────────────────────────────────────────────────────

create table constraint_rule (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  scope_type constraint_scope not null default 'staff',
  scope_id text not null, -- staff uuid, or ratio_type name when scope=role
  rule_type constraint_rule_type not null,
  params jsonb not null default '{}',
  effective_start date not null,
  effective_end date,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ─── Live board & volume ───────────────────────────────────────────────────

create table live_status (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  status live_status_value not null,
  work_type_id uuid references work_type(id) on delete set null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz
);

create table volume_data (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  date date not null,
  hour int not null check (hour between 0 and 23),
  script_count int not null default 0,
  unique (tenant_id, location_id, date, hour)
);

-- ─── Notifications, logs, compliance ───────────────────────────────────────

create table notification (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  user_id uuid not null,
  type text not null,
  payload jsonb not null default '{}',
  channel notification_channel not null default 'in_app',
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create table activity_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  actor_user_id uuid,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  detail jsonb,
  created_at timestamptz not null default now()
);

create table override_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  actor_user_id uuid not null,
  target_type text not null check (target_type in ('shift', 'slot')),
  target_id text not null,
  warning_type warning_type not null,
  reason text not null,
  created_at timestamptz not null default now()
);

create table compliance_snapshot (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  schedule_period_id uuid not null references schedule_period(id) on delete cascade,
  ratio_zone_id uuid not null references ratio_zone(id) on delete cascade,
  generated_at timestamptz not null default now(),
  rows jsonb not null default '[]'
);

-- Global content — no tenant_id by design
create table help_article (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  body_markdown text not null,
  category text not null,
  sort_order int not null default 0,
  published boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ─── Indexes ───────────────────────────────────────────────────────────────

create index idx_location_tenant on location(tenant_id);
create index idx_ratio_zone_tenant on ratio_zone(tenant_id);
create index idx_department_tenant on department(tenant_id);
create index idx_staff_tenant on staff(tenant_id);
create index idx_app_user_tenant on app_user(tenant_id);
create index idx_app_user_supabase on app_user(supabase_user_id);
create index idx_work_type_tenant on work_type(tenant_id);
create index idx_shift_tenant_date on shift(tenant_id, date);
create index idx_shift_period on shift(schedule_period_id);
create index idx_shift_staff on shift(staff_id);
create index idx_segment_shift on shift_segment(shift_id);
create index idx_segment_tenant on shift_segment(tenant_id);
create index idx_period_tenant on schedule_period(tenant_id, location_id);
create index idx_tor_tenant_status on time_off_request(tenant_id, status);
create index idx_callout_tenant on callout(tenant_id);
create index idx_swap_tenant_status on swap_request(tenant_id, status);
create index idx_constraint_tenant on constraint_rule(tenant_id, active);
create index idx_live_status_tenant on live_status(tenant_id, staff_id);
create index idx_notification_user on notification(user_id, read);
create index idx_activity_tenant on activity_log(tenant_id, created_at);
create index idx_override_tenant on override_log(tenant_id, created_at);
create index idx_snapshot_period on compliance_snapshot(schedule_period_id);
create index idx_ratio_rule_state on ratio_rule(state) where tenant_id is null;
