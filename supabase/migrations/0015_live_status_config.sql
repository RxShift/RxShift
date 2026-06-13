-- Live-board status configuration + alert state.
--
-- Statuses stay a fixed enum (live_status_value) — no risky type change. This
-- table only DECORATES those fixed values per tenant: which to show, what to
-- call them, and whether each counts toward the ratio. A tenant with no rows
-- behaves exactly as before (Working counts; Lunch / Meeting / Off-floor /
-- Non-tech don't), so there is no backfill and no behavior change on upgrade.

create table live_status_config (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  status live_status_value not null,
  enabled boolean not null default true,
  label text,                         -- null/blank = use the built-in label
  counts_toward_ratio boolean not null default false,
  created_at timestamptz not null default now(),
  unique (tenant_id, status)
);
create index idx_live_status_config_tenant on live_status_config(tenant_id);

alter table live_status_config enable row level security;
create policy lsc_select on live_status_config for select
  using (tenant_id = private.user_tenant_id());
create policy lsc_manager_all on live_status_config for all
  using (tenant_id = private.user_tenant_id() and private.is_manager())
  with check (tenant_id = private.user_tenant_id() and private.is_manager());

grant all privileges on live_status_config to anon, authenticated, service_role;

-- Per-zone deficiency tracking for live-board alerts. A cron evaluates each
-- ratio zone's current slot; this row remembers when a zone first went
-- deficient (for the grace window) and when we last alerted (for the cooldown),
-- so a brief mis-click that self-corrects never fires an alert, and an ongoing
-- deficiency isn't re-sent every tick. The service-role cron is the only
-- writer; managers may read it for transparency.

create table live_ratio_alert_state (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  ratio_zone_id uuid not null references ratio_zone(id) on delete cascade,
  deficient_since timestamptz,        -- start of the current unbroken deficiency; null = compliant
  last_alerted_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (tenant_id, ratio_zone_id)
);
create index idx_live_ratio_alert_state_tenant on live_ratio_alert_state(tenant_id);

alter table live_ratio_alert_state enable row level security;
create policy lras_select on live_ratio_alert_state for select
  using (tenant_id = private.user_tenant_id() and private.is_manager());
-- No authenticated insert/update/delete policy: only the service-role cron
-- writes this table (service_role bypasses RLS).

grant all privileges on live_ratio_alert_state to anon, authenticated, service_role;
