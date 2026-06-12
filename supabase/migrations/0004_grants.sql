-- Tables created via the Management API SQL runner don't inherit the
-- default Supabase role grants. Grant the API roles access explicitly —
-- RLS (0002) still gates every row for anon/authenticated; service_role
-- bypasses RLS by design.

grant usage on schema public to anon, authenticated, service_role;
grant all privileges on all tables in schema public to anon, authenticated, service_role;
grant all privileges on all sequences in schema public to anon, authenticated, service_role;
grant all privileges on all functions in schema public to anon, authenticated, service_role;

alter default privileges in schema public
  grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public
  grant all on functions to anon, authenticated, service_role;

-- The RLS helper functions live in the private schema; policies call them
-- as the requesting role, so authenticated/anon need execute.
grant usage on schema private to anon, authenticated, service_role;
grant execute on all functions in schema private to anon, authenticated, service_role;
alter default privileges in schema private
  grant execute on functions to anon, authenticated, service_role;
