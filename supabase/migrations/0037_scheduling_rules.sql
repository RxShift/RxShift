-- 0037 — Scheduling rules (positive scheduling instructions)
--
-- Constraints (constraint_rule) are GUARDS — things a person CAN'T do, flagged at
-- schedule time. Scheduling rules are the opposite: positive instructions the system
-- should actively schedule FOR a person — their regular weekly pattern plus recurring
-- exceptions (e.g. James every-other-Monday hospice 7:30–4; Juliana 3rd-Thursday
-- consulting 1hr; Victor Wednesday SPC). They drive the propose-and-accept flow on the
-- builder: the resolver expands active rules into concrete candidate shifts, the
-- engine validates them, and the scheduler clicks Accept. Nothing here auto-commits a
-- shift — rules only ever PROPOSE.
--
-- Shape mirrors constraint_rule: a rule_type enum + a params jsonb for the variable
-- bits (days, occurrence, times, quotas), so adding rule types later needs no schema
-- change. The fields we query/scope/join on are first-class columns. One row per rule
-- per staff member.

create type scheduling_rule_type as enum (
  'recurring_shift',                -- base regular pattern: days + times (+ optional work type)
  'preferred_shift_length',         -- prefers a shift length (e.g. 4×10)
  'preferred_days',                 -- soft day-of-week preference
  'preferred_work_type_by_day',     -- on weekday X, assign work type Y when possible
  'recurring_work_type_assignment', -- on a cadence, assign a work type (e.g. e/o Monday hospice)
  'monthly_quota',                  -- ≥N occurrences of a work type per month (remote/consulting)
  'nth_weekday_assignment',         -- nth weekday of the month → work type (3rd Thursday consulting)
  'quarterly_project_days',         -- extra days in the last week of given months
  'float_location',                 -- informational: sometimes covers another location/area
  'per_diem_availability',          -- commits N days per period, limited predictability
  'preferred_not_assigned'          -- soft: don't assign this work type even if the role allows it
);

create table if not exists staff_scheduling_rule (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  rule_type scheduling_rule_type not null,
  -- Optional work type this rule assigns (FK so it picks up the type's color +
  -- counting default). Null for rules that don't name a work type.
  work_type_id uuid references work_type(id) on delete set null,
  -- Optional location this rule applies to. Null = any / the person's home location.
  location_id uuid references location(id) on delete set null,
  -- Cadence for recurring/quota rules. Null for always-on soft preferences.
  frequency text check (frequency in (
    'weekly', 'every_other_week', 'every_other_month',
    'monthly_by_date', 'monthly_by_occurrence', 'quarterly', 'annually'
  )),
  -- Type-specific settings: day_of_week (0–6) or days (int[]), week_occurrence (1–5),
  -- month_occurrence (int[] 1–12), preferred_start_time / preferred_end_time ("HH:MM"),
  -- shift_length_hours, quota_per_period, anchor_date (for every_other_* parity).
  params jsonb not null default '{}'::jsonb,
  notes text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create index if not exists staff_scheduling_rule_lookup_idx
  on staff_scheduling_rule(tenant_id, staff_id, is_active);

alter table staff_scheduling_rule enable row level security;

-- Manager-writable, member-readable — the same shape as constraint_rule and the other
-- manager-owned tenant tables (0002). Service role bypasses RLS for resolver/apply.
drop policy if exists staff_scheduling_rule_select on staff_scheduling_rule;
create policy staff_scheduling_rule_select on staff_scheduling_rule for select
  using (tenant_id = private.user_tenant_id());

drop policy if exists staff_scheduling_rule_manage on staff_scheduling_rule;
create policy staff_scheduling_rule_manage on staff_scheduling_rule for all
  using (tenant_id = private.user_tenant_id() and private.is_manager())
  with check (tenant_id = private.user_tenant_id() and private.is_manager());
