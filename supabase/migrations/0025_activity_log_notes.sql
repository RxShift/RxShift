-- 0025 — Append-only notes on audit-log entries
--
-- HARD RULE: an activity_log entry is never edited or deleted. But an authorized
-- user must be able to ADD context to one — e.g. "RPh forgot to clock back from
-- lunch; corrected." So notes live in their own table, reference the original by
-- id, and are themselves append-only (select + insert policies, no update/delete).

create table activity_log_note (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  activity_log_id uuid not null references activity_log(id) on delete cascade,
  author_user_id uuid,
  note text not null,
  created_at timestamptz not null default now()
);

create index activity_log_note_log_idx on activity_log_note(activity_log_id);

alter table activity_log_note enable row level security;

-- Managers (the same audience that can read the audit log) may read + append.
-- No update/delete policy: RLS denies what isn't granted, so notes are immutable.
create policy aln_select on activity_log_note for select
  using (tenant_id = private.user_tenant_id() and private.is_manager());
create policy aln_insert on activity_log_note for insert
  with check (tenant_id = private.user_tenant_id() and private.is_manager());
