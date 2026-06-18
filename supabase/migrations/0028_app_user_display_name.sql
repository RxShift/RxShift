-- 0028 — App user display name
--
-- An optional human name for an app_user. The override log and compliance record
-- resolve the "who" of an action to the linked staff member's name; an owner_admin
-- who is NOT on the staff roster (e.g. a pharmacy owner who doesn't work the
-- counter, or the Mesa Vista demo owner Frank DiMaggio) previously fell back to the
-- raw role string ("owner_admin"). This gives those accounts a real display name.
-- Nullable, no default — staff-linked users still resolve via staff.full_name first.

alter table app_user add column if not exists display_name text;
