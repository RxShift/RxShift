-- Unpaid breaks: subtracted from paid hours, NOT from coverage/ratio calculations.
-- break_minutes is per-shift; default_break_minutes seeds new shifts when
-- shift duration >= 6 hours (AI create or copy-forward).
--
-- NOTE: This file was reconstructed June 13, 2026. The migration was applied to
-- Supabase on June 12, 2026 (version 20260612192531) via MCP apply_migration
-- but the local file was not written at the time. The schema is already live.

alter table shift
  add column if not exists break_minutes integer not null default 0;

alter table tenant
  add column if not exists default_break_minutes integer not null default 30;
