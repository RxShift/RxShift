-- 0039: tenant-wide time-of-day display format (12-hour AM/PM vs 24-hour military).
-- Default '12h' so every existing tenant unifies on AM/PM (the US retail norm);
-- military is the opt-in. Applied to display only — stored times stay "HH:MM".

alter table tenant
  add column if not exists time_format text not null default '12h'
  check (time_format in ('12h', '24h'));
