-- M2b (product pass, slice S3): where a shopping list came from, and which
-- spec object each row fills.
--
-- Additive only. shopping_lists.spec_source records whether the list was built
-- from the confirmed design spec or from the room-type blueprint (a room whose
-- spec could not be read), and spec_id which spec version built it, so the
-- matching screen states the list's provenance from the list itself rather than
-- from the room's live spec state. shopping_list_items.spec_key carries the spec
-- object's stable key ("3:floor_lamp"), so swaps and refills resolve the row's
-- contract by identity, not by a label the user may since have edited.
alter table public.shopping_lists
  add column spec_source text check (spec_source in ('confirmed_spec', 'blueprint_fallback')),
  add column spec_id uuid references public.room_design_specs(id) on delete set null;

alter table public.shopping_list_items
  add column spec_key text;
