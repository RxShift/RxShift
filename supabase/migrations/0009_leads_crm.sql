-- Internal CRM: sales-qualified leads + append-only notes. Platform-admin
-- only — RLS is enabled with NO policies, so these tables are reachable
-- exclusively through the service-role client (server actions / API
-- routes gated by requirePlatformAdmin). Customers can never see leads.

create table leads (
  id uuid primary key default gen_random_uuid(),
  pharmacy_name text not null,
  location_count int,
  contact_name text,
  contact_email text,
  contact_phone text,
  source text not null default 'inbound'
    check (source in ('inbound', 'referral', 'LinkedIn', 'Susie', 'cold')),
  stage text not null default 'Lead'
    check (stage in ('Lead', 'Demo', 'Trial', 'Active', 'Churned')),
  state text,
  message text,
  source_page text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references leads(id) on delete cascade,
  author text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create index idx_leads_updated on leads(updated_at desc);
create index idx_lead_notes_lead on lead_notes(lead_id, created_at);

create or replace function touch_leads_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger leads_touch_updated
  before update on leads
  for each row execute function touch_leads_updated_at();

alter table leads enable row level security;
alter table lead_notes enable row level security;
-- No policies: service-role only, by design.
