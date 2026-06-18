-- 0027 — Demo clock
--
-- A demo-only "pretend it's this time of day" override ("HH:MM"). When set on a
-- demo tenant, the live board / My Schedule / live-status evaluation pin "now"
-- to this time on the real (tenant-tz) date, so an after-hours walkthrough still
-- shows staff on shift. Real tenants leave it null and use the true clock.
-- Nullable, no default — existing tenants are unaffected.

alter table tenant add column if not exists demo_clock text;
