-- Platform administration: lets the product owner (and future RxShift
-- staff) administer every tenant, switch between them, and emulate any
-- user to see exactly what they see. Tenant scoping happens in the RLS
-- helper functions, so the whole app follows automatically.

create table platform_admin (
  supabase_user_id uuid primary key,
  note text,
  active_tenant_id uuid references tenant(id) on delete set null,
  emulate_app_user_id uuid references app_user(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table platform_admin enable row level security;
-- A signed-in user may see only their own row (the app uses it to ask
-- "am I a platform admin?"). All writes go through the service role.
create policy platform_admin_select_own on platform_admin for select
  using (supabase_user_id = auth.uid());

-- Per-tenant outbound email kill switch — demo tenants never email anyone.
alter table tenant add column outbound_email_enabled boolean not null default true;

-- ─── Helper functions now honor platform-admin overrides ───────────────────
-- Resolution order: emulated user > admin's active tenant > own membership.

create or replace function private.user_tenant_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select au.tenant_id
       from platform_admin pa
       join app_user au on au.id = pa.emulate_app_user_id
      where pa.supabase_user_id = auth.uid()),
    (select pa.active_tenant_id
       from platform_admin pa
      where pa.supabase_user_id = auth.uid()),
    (select tenant_id from app_user where supabase_user_id = auth.uid() limit 1)
  );
$$;

create or replace function private.user_role()
returns app_role
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    (select au.role
       from platform_admin pa
       join app_user au on au.id = pa.emulate_app_user_id
      where pa.supabase_user_id = auth.uid()),
    (select case when pa.active_tenant_id is not null
                 then 'owner_admin'::app_role end
       from platform_admin pa
      where pa.supabase_user_id = auth.uid()),
    (select role from app_user where supabase_user_id = auth.uid() limit 1)
  );
$$;

create or replace function private.user_staff_id()
returns uuid
language sql
security definer
set search_path = public
stable
as $$
  select case
    -- Emulating: act as the emulated user's staff record
    when exists (select 1 from platform_admin pa
                  where pa.supabase_user_id = auth.uid()
                    and pa.emulate_app_user_id is not null)
      then (select au.staff_id
              from platform_admin pa
              join app_user au on au.id = pa.emulate_app_user_id
             where pa.supabase_user_id = auth.uid())
    -- Administering a foreign tenant: no staff identity there
    when exists (select 1 from platform_admin pa
                  where pa.supabase_user_id = auth.uid()
                    and pa.active_tenant_id is not null)
      then null
    else (select staff_id from app_user where supabase_user_id = auth.uid() limit 1)
  end;
$$;

create or replace function private.is_manager()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select coalesce(
    private.user_role() in ('owner_admin', 'scheduler', 'supervisor'),
    false
  );
$$;
