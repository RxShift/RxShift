-- 0034 — PTO as a first-class, persistent record
--
-- PTO was previously implied only by approved time_off_request rows (whose shifts
-- get deleted on approval). That couples PTO to the request/approval lifecycle and
-- to a date range. A scheduler also needs to mark someone out DIRECTLY, and PTO
-- months in the future must show on the grid before any period is published.
--
-- `pto_day` is the simple, durable fact: a person is off on a date. One row per
-- person per date. It's independent of publish/period state. It is written two
-- ways — by time-off approval (in addition to the existing shift deletion) and by
-- a scheduler directly (the "PTO" checkbox on the shift editor, which also deletes
-- any shift that day). The compliance engine never reads this table: PTO affects
-- ratio only by the ABSENCE of a shift, so the engine stays the single source of
-- compliance truth.
--
-- The optional `reason` lives here, NOT in override_log (that channel is only for
-- acknowledged compliance-flag overrides). `tenant.pto_reason_required` makes the
-- reason mandatory, mirroring `tenant.require_department`.

create table if not exists pto_day (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  staff_id uuid not null references staff(id) on delete cascade,
  date date not null,
  reason text,
  created_by uuid,
  created_at timestamptz not null default now(),
  unique (tenant_id, staff_id, date)
);

create index if not exists pto_day_tenant_date_idx on pto_day(tenant_id, date);

alter table pto_day enable row level security;

-- Member-readable (staff can see their own PTO on the grid), manager-writable —
-- the same shape as the other manager-owned tenant tables. Staff do NOT insert
-- here; staff-initiated PTO still flows through time_off_request.
drop policy if exists pto_day_select on pto_day;
create policy pto_day_select on pto_day for select
  using (tenant_id = private.user_tenant_id());

drop policy if exists pto_day_manage on pto_day;
create policy pto_day_manage on pto_day for all
  using (tenant_id = private.user_tenant_id() and private.is_manager())
  with check (tenant_id = private.user_tenant_id() and private.is_manager());

-- When on, a reason is required to save any PTO (request-approved or scheduler-
-- entered). Default off — mirrors tenant.require_department.
alter table tenant add column if not exists pto_reason_required boolean not null default false;
