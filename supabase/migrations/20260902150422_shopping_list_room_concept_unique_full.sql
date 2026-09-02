-- M2d: replace M2c's PARTIAL unique index with a plain one.
--
-- Postgres cannot infer a partial index from `ON CONFLICT (room_id,
-- concept_id)` unless the conflict target repeats the index predicate, and
-- PostgREST's on_conflict parameter cannot express one. With the partial
-- index in place, the conflict-safe insert the sourcing service performs
-- would raise 42P10 on the FIRST run for every room and concept, after both
-- paid vision calls had already been made.
--
-- A plain unique index gives the same guarantee here: NULLs compare as
-- distinct in a unique index, so rows with no concept_id are still
-- unconstrained, exactly as the partial predicate intended.
drop index if exists public.shopping_lists_room_concept_key;

create unique index if not exists shopping_lists_room_concept_key
  on public.shopping_lists (room_id, concept_id);
