-- Multi-view concepts: additional camera-angle renders of an approved concept
-- are stored as room_assets linked back to their concept. The hero image keeps
-- using concepts.primary_image_asset_id; additional views carry concept_id +
-- view_key ('reverse_wide' | 'anchor_detail', open set for future views).

alter table public.room_assets
  add column concept_id uuid references public.concepts (id) on delete set null;

alter table public.room_assets
  add column view_key text;

create index room_assets_concept_id_idx on public.room_assets (concept_id)
  where concept_id is not null;
