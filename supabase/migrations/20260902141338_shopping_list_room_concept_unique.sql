-- M2c: one shopping list per (room, concept).
--
-- Sourcing reads "the list for this room and concept" and writes to it. With
-- no constraint, two concurrent runs could each insert their own list and
-- every later read would pick an arbitrary one, so a shopper could see a list
-- that is not the one the last run wrote. Verified free of duplicates on the
-- hosted project before applying; additive, and it makes the read
-- deterministic rather than changing any existing row.
create unique index if not exists shopping_lists_room_concept_key
  on public.shopping_lists (room_id, concept_id)
  where concept_id is not null;
