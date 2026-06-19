-- 0032 — Nevada R072-25 support: location type + drive-through + expected Rx
-- volume; staff_type (incl. technician-in-training); the R072-25 tenant toggle;
-- and a ceiling/floor/both flag on the immutable Compliance Record.
--
-- R072-25 (LCB File No. R072-25, proposed; public hearing June 4, 2026; NOT yet
-- adopted) adds: a 4-tech ceiling for retail non-institutional pharmacies (vs 3),
-- a 2-trainee sublimit, and a minimum-staffing FLOOR when only one pharmacist is
-- on duty. All of it is gated behind tenant.nevada_r072_25 (default off) and the
-- per-location location_type, so existing tenants are unaffected.

-- ── Location: type, drive-through, expected daily Rx volume (per weekday) ──────
create type location_type as enum ('retail', 'telepharmacy', 'institutional');

alter table location add column if not exists location_type location_type not null default 'retail';
alter table location add column if not exists has_drive_through boolean not null default false;
-- Expected daily Rx volume (informational only — collected for future R072-25
-- volume-minimum work; the schedule displays it, nothing enforces it yet).
alter table location add column if not exists expected_rx_mon int;
alter table location add column if not exists expected_rx_tue int;
alter table location add column if not exists expected_rx_wed int;
alter table location add column if not exists expected_rx_thu int;
alter table location add column if not exists expected_rx_fri int;
alter table location add column if not exists expected_rx_sat int;
alter table location add column if not exists expected_rx_sun int;

-- ── Staff: classification (distinct from ratio_type, which is how they COUNT) ──
-- staff_type adds the "technician in training" distinction R072-25 needs for the
-- 2-trainee sublimit; certified (migration 0013) stays, used for Tennessee.
create type staff_type as enum ('pharmacist', 'tech', 'tech_in_training');

alter table staff add column if not exists staff_type staff_type;

-- Backfill from existing data: ratio_type pharmacist → pharmacist; technician →
-- tech (or tech_in_training when the job title mentions "train"); everything else
-- (non_counting clerks etc.) → tech as a safe default. Then make it non-null.
update staff set staff_type =
  case
    when ratio_type = 'pharmacist' then 'pharmacist'::staff_type
    when ratio_type = 'technician' and coalesce(job_title, '') ~* 'train'
      then 'tech_in_training'::staff_type
    else 'tech'::staff_type
  end
where staff_type is null;

alter table staff alter column staff_type set not null;
alter table staff alter column staff_type set default 'tech';

-- ── Tenant: the R072-25 toggle (proposed — not yet adopted) ───────────────────
alter table tenant add column if not exists nevada_r072_25 boolean not null default false;

-- ── Compliance Record: distinguish a ceiling (too many) vs floor (too few) ────
-- deficiency, or both. Nullable; only set on deficient rows.
alter table compliance_record add column if not exists flag_type text
  check (flag_type in ('ceiling', 'floor', 'both'));
