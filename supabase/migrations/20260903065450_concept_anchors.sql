-- M3 (product pass, slice S3b): the hero pieces a concept was rendered around.
--
-- Anchored concepts invert S3's ordering for the pieces that carry the design.
-- Four real catalogue products are chosen BEFORE the render and their
-- photographs are passed to the image model as references, so the render
-- contains those exact pieces rather than something a later search has to
-- match. This table is what makes that durable: sourcing fills the REMAINING
-- roles instead of re-deciding these, the shopping list can say which rows are
-- in the render rather than matched to it, and the next room can avoid
-- anchoring on what the last one used.
--
-- Additive only.

create table public.concept_anchors (
  id uuid primary key default gen_random_uuid(),
  -- Both, deliberately: concept_id is the thing an anchor belongs to, and
  -- room_id is what the ownership policy and the recency read are keyed on.
  room_id uuid not null references public.rooms(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  -- The role's identity, its category, and the label as it was at the time.
  -- Copied rather than referenced: a blueprint that changes later must not
  -- rewrite what this render was actually built from.
  role_key text not null,
  role_category text not null,
  role_label text not null,
  -- restrict, as shopping_list_items does: an anchor is the record of what a
  -- paid render was built around, and deleting a catalogue row must not
  -- silently erase it.
  product_id uuid not null references public.products(id) on delete restrict,
  -- Which decided it: the aesthetic set pass, or the ranked shortlist when
  -- that pass could not run. A room is entitled to know.
  source text not null check (source in ('aesthetic_pass', 'ranked_shortlist')),
  reason text,
  selection_job_id uuid references public.ai_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  -- One anchor per role per concept. The upsert that writes them relies on it.
  unique (concept_id, role_key)
);

create index concept_anchors_room_id_idx on public.concept_anchors(room_id);
create index concept_anchors_product_id_idx on public.concept_anchors(product_id);
-- The recency read is "what has this owner anchored on lately", newest first.
create index concept_anchors_created_at_idx on public.concept_anchors(created_at desc);

alter table public.concept_anchors enable row level security;

create policy "room owners manage concept anchors" on public.concept_anchors
  for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));

-- A row the shopper is looking at is either IN the render or matched to it,
-- and those are different promises. Anchored rows are the first.
alter table public.shopping_list_items
  add column is_anchor boolean not null default false;
