-- 0019: email_log — a durable record of every email the app sends, written by the
-- single sendEmail() core in lib/email.ts. Platform-admin only: RLS is enabled with
-- NO policies, so all access goes through the service-role client behind
-- requirePlatformAdmin (exactly like the leads CRM). Stores the rendered HTML so an
-- admin can view the ACTUAL email that went out (and, later, expose it per-tenant).
-- tenant_id is nullable — auth/sign-in links and the public demo form have no tenant.

create table email_log (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenant(id) on delete set null,
  kind text not null,            -- notification | auth | demo_request | feedback | system
  to_email text not null,
  from_email text not null,
  subject text not null,
  body_html text,
  status text not null,          -- sent | suppressed | redirected | failed | delivered | bounced | complained
  redirected_to text,
  provider_message_id text,
  error text,
  related_type text,             -- e.g. 'lead'
  related_id uuid,
  actor_user_id uuid,
  created_at timestamptz not null default now()
);

create index idx_email_log_created on email_log(created_at desc);
create index idx_email_log_tenant on email_log(tenant_id);
create index idx_email_log_related on email_log(related_type, related_id);
create index idx_email_log_kind on email_log(kind);
create index idx_email_log_provider_msg on email_log(provider_message_id);

alter table email_log enable row level security;
-- No policies: service-role only, by design (platform-admin views via service client).
