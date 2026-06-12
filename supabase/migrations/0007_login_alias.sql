-- Login aliases: one account, multiple sign-in emails. A user types ANY of
-- their registered addresses at /app/login; the magic link is delivered to
-- that inbox but signs them into the one account. Solves the "magic link
-- must be opened on the device you're signing into" constraint (work
-- desktop = work inbox only, phone/home = personal inbox).

create table login_alias (
  alias_email text primary key check (alias_email = lower(alias_email)),
  app_user_id uuid not null references app_user(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index idx_login_alias_app_user on login_alias(app_user_id);
alter table login_alias enable row level security;
-- No policies: service-role only. An alias grants its inbox sign-in power
-- over the account, so only admin provisioning may create one (v1).
