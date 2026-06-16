-- 0020: feedback — one "issues" inbox for BOTH user-submitted feedback/bug/feature
-- reports AND system-detected problems (source='system', e.g. a failed send or a
-- bounce reported by the Resend webhook). Platform-admin managed: RLS enabled with
-- NO policies; all access via the service-role client (submitFeedback is gated by
-- requireMember in code, triage by requirePlatformAdmin). Screenshots live in a
-- private 'feedback' Storage bucket reached only through the service role.

create table feedback (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references tenant(id) on delete set null,
  actor_user_id uuid,
  staff_id uuid,
  source text not null default 'user' check (source in ('user', 'system')),
  kind text not null check (kind in ('bug', 'feature', 'feedback')),
  subject text not null,
  body text,
  screenshot_path text,
  page_url text,
  status text not null default 'new'
    check (status in ('new', 'triaged', 'in_progress', 'done', 'wont_do')),
  internal_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_feedback_created on feedback(created_at desc);
create index idx_feedback_status on feedback(status);
create index idx_feedback_source on feedback(source);

-- Reuse the generic updated_at trigger function defined in 0009 (leads CRM).
create trigger feedback_touch_updated
  before update on feedback
  for each row execute function touch_leads_updated_at();

alter table feedback enable row level security;
-- No policies: service-role only, by design.

-- Private 'feedback' Storage bucket for screenshots (service-role access only).
insert into storage.buckets (id, name, public)
  values ('feedback', 'feedback', false)
  on conflict (id) do nothing;
