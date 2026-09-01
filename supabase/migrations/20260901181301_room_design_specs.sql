-- M1 (product pass, slice S2): the canonical design spec extracted at concept
-- approval, plus revision bookkeeping on concepts and critiques.
--
-- Additive only. The plan named a concepts.revision_of column; concepts.parent_concept_id
-- already records exactly that lineage (set by the revision flow since the initial
-- schema), so no duplicate column is added.

-- One spec per (room, approved concept): objects carry role, label, quantity,
-- size/capacity, and palette/material descriptors extracted by the vision pass;
-- must_preserve lists architecture the renders may never change. The /spec screen
-- edits these and flips status to confirmed; sourcing consumes confirmed truth.
create table public.room_design_specs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  concept_id uuid not null references public.concepts(id) on delete cascade,
  objects jsonb not null default '[]'::jsonb,
  must_preserve jsonb not null default '[]'::jsonb,
  status text not null default 'extracted' check (status in ('extracted', 'confirmed')),
  extraction_job_id uuid references public.ai_jobs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (room_id, concept_id)
);

create index room_design_specs_room_id_idx on public.room_design_specs(room_id);

alter table public.room_design_specs enable row level security;

create policy "room owners manage design specs" on public.room_design_specs
  for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));

create trigger room_design_specs_set_updated_at before update on public.room_design_specs
  for each row execute function public.set_updated_at();

-- Written by the revision visual-diff QA: what changed vs the parent concept.
alter table public.concepts
  add column diff_summary text;

-- Links a critique to the revision it produced, so the concepts screen can show
-- which version answered which critique.
alter table public.concept_critiques
  add column concept_version_link uuid references public.concepts(id) on delete set null;
