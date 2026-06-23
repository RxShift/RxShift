-- 0035 — Tenant holidays
--
-- A simple, tenant-wide list of holidays (uniform across all of a tenant's
-- locations for now — the model stays open to per-location later, but we don't
-- build that yet). Purely VISUAL on the schedule: the grid tints and labels the
-- column. It never blocks staffing — a scheduler can still staff a holiday and
-- see at a glance who chose to work it.
--
-- Holidays are generated from a deterministic US-federal generator (lib/holidays.ts,
-- including the observed Sat->Fri / Sun->Mon rule), then freely added/removed/edited.

create table if not exists holiday (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  date date not null,
  name text not null,
  created_at timestamptz not null default now(),
  unique (tenant_id, date)
);

create index if not exists holiday_tenant_date_idx on holiday(tenant_id, date);

alter table holiday enable row level security;

-- Member-readable (it shows on the grid for everyone), manager-writable.
drop policy if exists holiday_select on holiday;
create policy holiday_select on holiday for select
  using (tenant_id = private.user_tenant_id());

drop policy if exists holiday_manage on holiday;
create policy holiday_manage on holiday for all
  using (tenant_id = private.user_tenant_id() and private.is_manager())
  with check (tenant_id = private.user_tenant_id() and private.is_manager());
