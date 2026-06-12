-- Tenant lifecycle + email safety.
--
-- status: 'setup' (mid-onboarding) → 'trial' (fully usable, outbound email
-- suppressed except to the allowlist) → 'live' (production, email flows).
-- The owner flips trial→live deliberately via Settings ("Go Live").
--
-- email_allowlist: when non-empty, ONLY these addresses can receive app
-- email from this tenant — everyone else is silently dropped at the mailer.
-- This is the hard guarantee that protects demo tenants seeded with real
-- staff rosters. Comparison is case-insensitive (normalized in code).

do $$ begin
  create type tenant_status as enum ('setup', 'trial', 'live');
exception when duplicate_object then null; end $$;

alter table tenant
  add column status tenant_status not null default 'setup',
  add column email_allowlist text[] not null default '{}';

-- Tenants that finished onboarding before this migration are operating
-- tenants: mark them live so their email behavior is unchanged.
update tenant set status = 'live' where onboarding_complete = true;
