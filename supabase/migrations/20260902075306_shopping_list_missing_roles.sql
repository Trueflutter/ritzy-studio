-- M2 (product pass, slice S3): honest missing-role output on shopping lists.
--
-- Additive only. Sourcing now runs against the confirmed design spec, and a
-- spec object the catalogue cannot honestly fill is recorded here instead of
-- being silently dropped: one entry per unsourced role with the reason and
-- what the user can do about it. The matching and shopping-list screens render
-- these rows; totals never count them.
alter table public.shopping_lists
  add column missing_roles jsonb not null default '[]'::jsonb,
  add constraint shopping_lists_missing_roles_is_array
    check (jsonb_typeof(missing_roles) = 'array');
