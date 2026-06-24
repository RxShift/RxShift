-- 0038 — Staff record fields, configurable week start, coverage notes, rule overrides
--
-- Part of the "Lucy scheduling logic" build:
--   • staff.scheduling_notes     — free-text scheduling notes shown prominently on the
--                                  staff record (e.g. "Clinically strong. Not suited for
--                                  audit or ticket confirmation. Prefers morning starts.")
--   • staff.excluded_from_ratio  — person is physically present but NEVER counts toward
--                                  the pharmacist:tech ratio, WITHOUT changing their RPh/
--                                  tech role or grid band. Use for pharmacy supervisors,
--                                  procurement, billing — present on the floor, excluded
--                                  by the state rule. The engine skips them entirely
--                                  (ceiling, trainee sublimit, AND the solo-pharmacist
--                                  floor). Distinct from ratio_type='non_counting', which
--                                  ALSO strips their role and drops them to "Other staff".
--   • tenant.week_start_day      — first day of the week (0=Sun … 6=Sat). Default 1 (Mon)
--                                  preserves the prior hardcoded Monday behavior; a tenant
--                                  can switch to Sunday. Drives the grid column order,
--                                  period alignment, and reporting week boundaries.
--   • location.coverage_notes    — free-text daily coverage targets shown in the builder
--                                  (e.g. "1 CCC RPh every weekday by 8:30am; 2.6 homeside
--                                  staff daily, never below 2"). Informational only.
--   • override_log warning_type  — add 'rule' so a dismissed unmet-rule warning is logged
--                                  the same way as a ratio/constraint override.

alter table staff add column if not exists scheduling_notes text;
alter table staff add column if not exists excluded_from_ratio boolean not null default false;

alter table tenant add column if not exists week_start_day int not null default 1
  check (week_start_day between 0 and 6);

alter table location add column if not exists coverage_notes text;

-- New enum value for dismissed scheduling-rule warnings. Added on its own (PG15 allows
-- ALTER TYPE ... ADD VALUE in a transaction as long as the value isn't USED in the same
-- transaction — it isn't here; the app writes it at runtime).
alter type warning_type add value if not exists 'rule';

-- Widen the override target check so a dismissed rule can be recorded against the rule
-- itself (append-only; mirrors 0024's widening for request overrides).
alter table override_log drop constraint if exists override_log_target_type_check;
alter table override_log add constraint override_log_target_type_check
  check (target_type in ('shift', 'slot', 'time_off', 'swap', 'callout', 'rule'));
