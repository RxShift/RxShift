-- 0029 — The Compliance Record (as-worked) + annotations
--
-- The board-defensible artifact: an IMMUTABLE, hour-by-hour record of what
-- ACTUALLY happened at each location — who was on and counting, whether the
-- pharmacist-to-technician ratio was met — derived from the published schedule
-- adjusted by the live-status history, frozen once the hour has passed.
--
-- This is distinct from:
--   • the Schedule + Coverage Forecast (what we PLANNED — regenerated on read +
--     the publish-time compliance_snapshot), and
--   • the Activity Log (who changed what, when).
--
-- HARD RULE: a compliance_record row is never edited or deleted. It is written
-- ONLY by the finalize-compliance job (service role; RLS has no insert/update/
-- delete policy, so users cannot mutate it). A manager who needs to explain a
-- past hour ADDS a note (compliance_record_note) — the determination stands, the
-- note adds context. Retained ≥2 years (NAC 639.744 / proposed R113-24).

create table compliance_record (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  location_id uuid not null references location(id) on delete cascade,
  date date not null,
  hour int not null check (hour >= 0 and hour < 24),
  ratio_status text not null check (ratio_status in ('compliant', 'deficient')),
  deficiency_reason text,
  -- The ratio cap in force when this hour was finalized (provenance).
  required_max_techs int,
  -- The full ComplianceRecordRow for this hour (pharmacists_on_duty,
  -- technicians_counting, technicians_count, technicians_present_non_counting).
  detail jsonb not null default '{}',
  recorded_at timestamptz not null default now(),
  unique (tenant_id, location_id, date, hour)
);

alter table compliance_record enable row level security;

-- Managers read it. NO insert/update/delete policy: RLS denies what isn't
-- granted, so the record is immutable to every user; the finalize job writes it
-- with the service-role key (which bypasses RLS).
create policy compliance_record_select on compliance_record for select
  using (tenant_id = private.user_tenant_id() and private.is_manager());

-- Append-only annotations (mirrors activity_log_note): managers read + append,
-- never edit/delete.
create table compliance_record_note (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenant(id) on delete cascade,
  compliance_record_id uuid not null references compliance_record(id) on delete cascade,
  author_user_id uuid,
  note text not null,
  created_at timestamptz not null default now()
);

create index compliance_record_note_rec_idx on compliance_record_note(compliance_record_id);

alter table compliance_record_note enable row level security;

create policy crn_select on compliance_record_note for select
  using (tenant_id = private.user_tenant_id() and private.is_manager());
create policy crn_insert on compliance_record_note for insert
  with check (tenant_id = private.user_tenant_id() and private.is_manager());
