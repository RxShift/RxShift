-- 0024 — Request-approval overrides
--
-- override_log previously only recorded publish-time overrides
-- (target_type 'shift' / 'slot'). Phase 3 also records an override when a
-- manager approves a PTO or swap that CREATES a ratio deficiency, so the
-- override log + compliance record stay complete and auditor-ready. Widen the
-- target_type check to cover those request kinds. Still append-only — nothing
-- here lets a row be edited or deleted.

alter table override_log
  drop constraint if exists override_log_target_type_check;

alter table override_log
  add constraint override_log_target_type_check
  check (target_type in ('shift', 'slot', 'time_off', 'swap', 'callout'));
