-- 0040: make call-outs real + reversible.
--
-- Before this, a call-out was a logged note only — it never removed the person
-- from the live ratio board, the schedule, or the Compliance Record, and there
-- was no way to undo one. This adds:
--   • callout_date  — the date the absence applies to (the live board + the
--     compliance finalizer read this to drop the person from the ratio count
--     while the call-out is active). Backfilled from the linked shift's date,
--     else the logged date.
--   • reversed_at / reversed_by — a call-out is ACTIVE while reversed_at is null;
--     reversing it ("I'm back at work") restores the person to coverage.
--   • callout_staff_update RLS — a staff member can reverse THEIR OWN call-out
--     (managers already have callout_manager_all). Scoped to own staff_id.

alter table callout
  add column if not exists callout_date date,
  add column if not exists reversed_at timestamptz,
  add column if not exists reversed_by uuid;

-- Backfill the absence date for existing rows: prefer the linked shift's date,
-- fall back to the date the call-out was logged.
update callout c
set callout_date = coalesce(
  (select s.date from shift s where s.id = c.shift_id),
  (c.logged_at at time zone 'UTC')::date
)
where c.callout_date is null;

-- A staff member may update their own call-out row (to reverse it). The server
-- action only ever writes the reversal fields; RLS just gates row access, and
-- this is scoped to the caller's own staff_id (not a blanket USING(true)).
create policy callout_staff_update on callout for update
  using (
    tenant_id = private.user_tenant_id()
    and staff_id = private.user_staff_id()
  )
  with check (
    tenant_id = private.user_tenant_id()
    and staff_id = private.user_staff_id()
  );
