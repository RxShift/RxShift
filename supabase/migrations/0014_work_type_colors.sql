-- Work-type colors: each work type gets a display color so schedules read
-- at a glance (the When I Work pattern Optum relies on). Color is pure
-- presentation — the compliance engine never reads it.
--
-- NULL = no color chosen; the UI renders a neutral steel/cloud block.

alter table work_type
  add column color text check (color ~* '^#[0-9A-F]{6}$');

-- Backfill the common seeded work types with palette colors so existing
-- tenants see color immediately. Names match the onboarding/demo seeds
-- (incl. the OptumRx roster's types, mapped to their When I Work hues:
-- utility = green, hospice = rose, SPC = purple, IV = magenta family).
-- Deliberately left neutral: Cleaning, Clerical, Off-floor / Meeting,
-- Remote — off-floor work reads quieter without a color.
update work_type set color = c.hex from (values
  ('Dispensing', '#3B6EA5'),
  ('Training', '#2BA39A'),
  ('Inventory', '#5B6B82'),
  ('Meeting', '#6A5ACD'),
  ('Working (on floor)', '#3B6EA5'),
  ('Verification', '#4B7BEC'),
  ('Production', '#2E8BC0'),
  ('IV / TPN', '#C2459E'),
  ('IV Room', '#7C5CCF'),
  ('SPC Compounding', '#9B4DCA'),
  ('Hospice Shift', '#C94F7C'),
  ('Utility / Project', '#3FA34D'),
  ('Counseling', '#2BA39A'),
  ('Charts / Clinical', '#2C7A7B'),
  ('CCC (Clinical Call Center)', '#0E7C86'),
  ('Supervisor', '#4C5FD5'),
  ('Runner (Homeside)', '#6B8E23'),
  ('Billing', '#6A5ACD'),
  ('Procurement', '#8A6240')
) as c(name, hex)
where work_type.name = c.name and work_type.color is null;
