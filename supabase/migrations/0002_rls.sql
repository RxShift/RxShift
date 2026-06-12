-- Row-level security: tenant isolation on every tenant table.
-- Helper functions live in a private schema and run as definer so they can
-- read app_user without recursive policy evaluation. The service role key
-- bypasses RLS (used server-side for onboarding and cron only).

create schema if not exists private;

create or replace function private.user_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select tenant_id from app_user where supabase_user_id = auth.uid() limit 1;
$$;

create or replace function private.user_role()
returns app_role
language sql
security definer
set search_path = public
stable
as $$
  select role from app_user where supabase_user_id = auth.uid() limit 1;
$$;

create or replace function private.user_staff_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select staff_id from app_user where supabase_user_id = auth.uid() limit 1;
$$;

create or replace function private.is_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select role in ('owner_admin', 'scheduler', 'supervisor')
     from app_user where supabase_user_id = auth.uid() limit 1),
    false
  );
$$;

-- ─── tenant ────────────────────────────────────────────────────────────────
alter table tenant enable row level security;
create policy tenant_select on tenant for select
  using (id = private.user_tenant_id());
create policy tenant_update on tenant for update
  using (id = private.user_tenant_id() and private.user_role() = 'owner_admin');

-- ─── app_user ──────────────────────────────────────────────────────────────
alter table app_user enable row level security;
create policy app_user_select on app_user for select
  using (
    supabase_user_id = auth.uid()
    or (tenant_id = private.user_tenant_id() and private.is_manager())
  );
create policy app_user_admin_write on app_user for all
  using (tenant_id = private.user_tenant_id() and private.user_role() = 'owner_admin')
  with check (tenant_id = private.user_tenant_id() and private.user_role() = 'owner_admin');

-- ─── Manager-writable, member-readable tenant tables ───────────────────────
-- location, ratio_zone, department, staff, staff_location, work_type,
-- schedule_period, shift, shift_segment, constraint_rule, volume_data,
-- compliance_snapshot

do $$
declare t text;
begin
  foreach t in array array[
    'location', 'ratio_zone', 'department', 'staff', 'staff_location',
    'work_type', 'schedule_period', 'shift', 'shift_segment',
    'constraint_rule', 'volume_data', 'compliance_snapshot'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format(
      'create policy %I_select on %I for select using (tenant_id = private.user_tenant_id())',
      t, t
    );
    execute format(
      'create policy %I_manage on %I for all
         using (tenant_id = private.user_tenant_id() and private.is_manager())
         with check (tenant_id = private.user_tenant_id() and private.is_manager())',
      t, t
    );
  end loop;
end $$;

-- ─── ratio_rule: global seeds readable by all signed-in users ───────────────
alter table ratio_rule enable row level security;
create policy ratio_rule_select on ratio_rule for select
  using (tenant_id is null or tenant_id = private.user_tenant_id());
create policy ratio_rule_manage on ratio_rule for all
  using (tenant_id = private.user_tenant_id() and private.is_manager())
  with check (tenant_id = private.user_tenant_id() and private.is_manager());

-- ─── time_off_request: staff create + read own; managers everything ────────
alter table time_off_request enable row level security;
create policy tor_select on time_off_request for select
  using (
    tenant_id = private.user_tenant_id()
    and (private.is_manager() or staff_id = private.user_staff_id())
  );
create policy tor_staff_insert on time_off_request for insert
  with check (
    tenant_id = private.user_tenant_id()
    and staff_id = private.user_staff_id()
  );
create policy tor_manager_all on time_off_request for all
  using (tenant_id = private.user_tenant_id() and private.is_manager())
  with check (tenant_id = private.user_tenant_id() and private.is_manager());

-- ─── callout: staff log own; managers everything ────────────────────────────
alter table callout enable row level security;
create policy callout_select on callout for select
  using (
    tenant_id = private.user_tenant_id()
    and (private.is_manager() or staff_id = private.user_staff_id())
  );
create policy callout_staff_insert on callout for insert
  with check (
    tenant_id = private.user_tenant_id()
    and staff_id = private.user_staff_id()
  );
create policy callout_manager_all on callout for all
  using (tenant_id = private.user_tenant_id() and private.is_manager())
  with check (tenant_id = private.user_tenant_id() and private.is_manager());

-- ─── swap_request: parties see + act on their own; managers everything ─────
alter table swap_request enable row level security;
create policy swap_select on swap_request for select
  using (
    tenant_id = private.user_tenant_id()
    and (
      private.is_manager()
      or requesting_staff_id = private.user_staff_id()
      or counter_staff_id = private.user_staff_id()
    )
  );
create policy swap_staff_insert on swap_request for insert
  with check (
    tenant_id = private.user_tenant_id()
    and requesting_staff_id = private.user_staff_id()
  );
create policy swap_peer_update on swap_request for update
  using (
    tenant_id = private.user_tenant_id()
    and counter_staff_id = private.user_staff_id()
    and status = 'pending_peer'
  );
create policy swap_manager_all on swap_request for all
  using (tenant_id = private.user_tenant_id() and private.is_manager())
  with check (tenant_id = private.user_tenant_id() and private.is_manager());

-- ─── live_status: everyone in tenant reads; staff set own; managers all ────
alter table live_status enable row level security;
create policy live_select on live_status for select
  using (tenant_id = private.user_tenant_id());
create policy live_staff_write on live_status for insert
  with check (
    tenant_id = private.user_tenant_id()
    and staff_id = private.user_staff_id()
  );
create policy live_staff_update on live_status for update
  using (
    tenant_id = private.user_tenant_id()
    and staff_id = private.user_staff_id()
  );
create policy live_manager_all on live_status for all
  using (tenant_id = private.user_tenant_id() and private.is_manager())
  with check (tenant_id = private.user_tenant_id() and private.is_manager());

-- ─── notification: own rows only ───────────────────────────────────────────
alter table notification enable row level security;
create policy notification_select on notification for select
  using (tenant_id = private.user_tenant_id() and user_id = auth.uid());
create policy notification_update on notification for update
  using (tenant_id = private.user_tenant_id() and user_id = auth.uid());
create policy notification_insert on notification for insert
  with check (tenant_id = private.user_tenant_id());

-- ─── activity_log / override_log: append-only for members ──────────────────
alter table activity_log enable row level security;
create policy activity_select on activity_log for select
  using (tenant_id = private.user_tenant_id() and private.is_manager());
create policy activity_insert on activity_log for insert
  with check (tenant_id = private.user_tenant_id());

alter table override_log enable row level security;
create policy override_select on override_log for select
  using (tenant_id = private.user_tenant_id() and private.is_manager());
create policy override_insert on override_log for insert
  with check (tenant_id = private.user_tenant_id() and private.is_manager());

-- ─── help_article: global, readable by any signed-in user ──────────────────
alter table help_article enable row level security;
create policy help_select on help_article for select
  using (published = true and auth.uid() is not null);
