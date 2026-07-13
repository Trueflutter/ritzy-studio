-- Codify the service_role grants that the hosted project carries but migrations never created.
-- A fresh provision (local `supabase start` + migrations, or a new hosted project) left
-- service_role unable to read/write the app tables or execute functions; every server-side
-- path that uses the service client failed until these were applied by hand
-- (see docs/FABLE_PROGRESS.md, 2026-07-10). Idempotent: re-granting existing privileges is a
-- no-op, so this is safe on the hosted project.

grant usage on schema public to service_role;

grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Future objects created by the migration role must carry the same grants, or the next
-- `create table` migration silently reintroduces the fresh-provision breakage.
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant all on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
