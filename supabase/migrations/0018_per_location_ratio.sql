-- 0018: Ratio is per-LOCATION. Remove the ratio_zone concept entirely — everyone
-- counting toward ratio at a location counts together; an "isolated room" is just
-- a separate location. Departments become tenant-level (shared, not bound to one
-- location). Add a per-tenant "require a department on every shift" setting and
-- staff avatars (stored in a private Supabase Storage bucket).
--
-- Pre-customer data only (Test/OptumRx/Mesa Vista demo tenants). Verified before
-- writing: every shift's location_id already matches its zone's location_id, so
-- dropping the zone link loses no scheduling data — shifts simply count toward
-- their location's ratio (which is the correction we want).

-- ── compliance_snapshot: re-point ratio_zone -> location ─────────────────────
alter table compliance_snapshot
  add column location_id uuid references location(id) on delete cascade;
update compliance_snapshot cs
  set location_id = z.location_id
  from ratio_zone z
  where z.id = cs.ratio_zone_id;
alter table compliance_snapshot alter column location_id set not null;
alter table compliance_snapshot drop column ratio_zone_id;

-- ── live_ratio_alert_state: re-point ratio_zone -> location ──────────────────
alter table live_ratio_alert_state
  add column location_id uuid references location(id) on delete cascade;
update live_ratio_alert_state s
  set location_id = z.location_id
  from ratio_zone z
  where z.id = s.ratio_zone_id;
alter table live_ratio_alert_state
  drop constraint live_ratio_alert_state_tenant_id_ratio_zone_id_key;
alter table live_ratio_alert_state drop column ratio_zone_id;
alter table live_ratio_alert_state alter column location_id set not null;
alter table live_ratio_alert_state
  add constraint live_ratio_alert_state_tenant_id_location_id_key
  unique (tenant_id, location_id);

-- ── shift: drop the zone link (every shift already carries location_id) ──────
alter table shift drop column ratio_zone_id;

-- ── drop the ratio_zone table (cascades its index + RLS policies) ────────────
drop table ratio_zone cascade;

-- ── department: tenant-level (shared), no longer bound to one location ───────
alter table department drop column location_id;

-- ── tenant: optional "require a department on every shift" ───────────────────
alter table tenant add column require_department boolean not null default false;

-- ── staff: avatar (path within the private 'avatars' Storage bucket) ─────────
alter table staff add column avatar_path text;

-- ── avatars Storage bucket (private; tenant-scoped via path + RLS) ───────────
-- Path convention: avatars/{tenant_id}/{staff_id}-{ts}.{ext}
insert into storage.buckets (id, name, public)
  values ('avatars', 'avatars', false)
  on conflict (id) do nothing;

create policy "avatars tenant read" on storage.objects for select to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = private.user_tenant_id()::text
  );
create policy "avatars manager insert" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = private.user_tenant_id()::text
    and private.is_manager()
  );
create policy "avatars manager update" on storage.objects for update to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = private.user_tenant_id()::text
    and private.is_manager()
  );
create policy "avatars manager delete" on storage.objects for delete to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = private.user_tenant_id()::text
    and private.is_manager()
  );
