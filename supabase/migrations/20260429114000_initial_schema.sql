create extension if not exists vector with schema extensions;

create type public.user_role as enum ('owner', 'designer', 'admin');
create type public.project_status as enum ('draft', 'active', 'archived');
create type public.room_status as enum ('draft', 'briefing', 'concepting', 'sourcing', 'rendering', 'complete');
create type public.asset_type as enum ('room_photo', 'floor_plan', 'thumbnail', 'concept_render', 'final_render');
create type public.measurement_source as enum ('manual', 'floor_plan', 'annotation', 'estimated');
create type public.confidence_level as enum ('verified', 'assumed', 'estimated', 'unknown');
create type public.question_status as enum ('open', 'answered', 'skipped');
create type public.concept_status as enum ('draft', 'generated', 'selected', 'rejected');
create type public.retailer_status as enum ('active', 'paused', 'blocked', 'candidate');
create type public.shopping_list_status as enum ('draft', 'approved', 'archived');
create type public.ai_job_status as enum ('queued', 'running', 'succeeded', 'failed', 'cancelled');

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  name text,
  role public.user_role not null default 'designer',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  client_name text,
  location text,
  budget_min_aed numeric(12, 2),
  budget_max_aed numeric(12, 2),
  status public.project_status not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  constraint projects_budget_order check (
    budget_min_aed is null
    or budget_max_aed is null
    or budget_min_aed <= budget_max_aed
  )
);

create table public.rooms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  name text not null,
  room_type text not null,
  status public.room_status not null default 'draft',
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.room_assets (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  asset_type public.asset_type not null,
  storage_path text not null,
  mime_type text not null,
  width_px integer,
  height_px integer,
  is_primary boolean not null default false,
  created_at timestamptz not null default now(),
  unique (storage_path)
);

create table public.room_measurements (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  source public.measurement_source not null,
  wall_length_cm numeric(10, 2),
  room_depth_cm numeric(10, 2),
  ceiling_height_cm numeric(10, 2),
  floor_plan_asset_id uuid references public.room_assets(id) on delete set null,
  confidence public.confidence_level not null default 'unknown',
  notes text,
  created_at timestamptz not null default now()
);

create table public.design_briefs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  style_notes text,
  color_notes text,
  budget_notes text,
  functional_requirements text,
  avoid_notes text,
  inspiration_notes text,
  structured_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.clarifying_questions (
  id uuid primary key default gen_random_uuid(),
  design_brief_id uuid not null references public.design_briefs(id) on delete cascade,
  question text not null,
  answer text,
  status public.question_status not null default 'open',
  created_at timestamptz not null default now(),
  answered_at timestamptz
);

create table public.ai_jobs (
  id uuid primary key default gen_random_uuid(),
  job_type text not null,
  status public.ai_job_status not null default 'queued',
  provider text not null,
  model text not null,
  prompt_version text,
  input_summary jsonb not null default '{}'::jsonb,
  output_summary jsonb not null default '{}'::jsonb,
  cost_estimate_usd numeric(10, 4),
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.concepts (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  design_brief_id uuid not null references public.design_briefs(id) on delete cascade,
  parent_concept_id uuid references public.concepts(id) on delete set null,
  title text not null,
  description text,
  status public.concept_status not null default 'draft',
  generation_job_id uuid references public.ai_jobs(id) on delete set null,
  primary_image_asset_id uuid references public.room_assets(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.concept_critiques (
  id uuid primary key default gen_random_uuid(),
  concept_id uuid not null references public.concepts(id) on delete cascade,
  critique_text text not null,
  created_by_user_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.retailers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null,
  country text not null default 'AE',
  adapter_key text not null unique,
  status public.retailer_status not null default 'candidate',
  robots_notes text,
  terms_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid not null references public.retailers(id) on delete cascade,
  external_sku text,
  canonical_url text not null,
  name text not null,
  description text,
  category_raw text,
  category_normalized text,
  price_aed numeric(12, 2),
  sale_price_aed numeric(12, 2),
  currency text not null default 'AED',
  availability text,
  primary_image_url text,
  color text,
  material text,
  style_tags text[] not null default '{}',
  room_tags text[] not null default '{}',
  data_confidence public.confidence_level not null default 'unknown',
  last_checked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (retailer_id, canonical_url)
);

create table public.product_dimensions (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  width_cm numeric(10, 2),
  depth_cm numeric(10, 2),
  height_cm numeric(10, 2),
  diameter_cm numeric(10, 2),
  source_text text,
  confidence public.confidence_level not null default 'unknown',
  created_at timestamptz not null default now()
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null,
  storage_path text,
  sort_order integer not null default 0,
  alt_text text,
  source text,
  created_at timestamptz not null default now()
);

create table public.product_embeddings (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  embedding_type text not null,
  model text not null,
  vector extensions.vector(1536),
  source_hash text not null,
  created_at timestamptz not null default now(),
  unique (product_id, embedding_type, model, source_hash)
);

create table public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  retailer_id uuid references public.retailers(id) on delete set null,
  adapter_key text not null,
  status public.ai_job_status not null default 'queued',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  products_seen integer not null default 0,
  products_created integer not null default 0,
  products_updated integer not null default 0,
  products_failed integer not null default 0,
  error_summary text
);

create table public.shopping_lists (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  status public.shopping_list_status not null default 'draft',
  estimated_total_aed numeric(12, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.shopping_list_items (
  id uuid primary key default gen_random_uuid(),
  shopping_list_id uuid not null references public.shopping_lists(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  category text not null,
  quantity integer not null default 1 check (quantity > 0),
  unit_price_aed numeric(12, 2),
  line_total_aed numeric(12, 2),
  selection_reason text,
  dimension_fit_note text,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.render_jobs (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.rooms(id) on delete cascade,
  concept_id uuid references public.concepts(id) on delete set null,
  shopping_list_id uuid references public.shopping_lists(id) on delete set null,
  status public.ai_job_status not null default 'queued',
  prompt_version text,
  model text,
  input_asset_ids uuid[] not null default '{}',
  output_asset_ids uuid[] not null default '{}',
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index projects_owner_user_id_idx on public.projects(owner_user_id);
create index rooms_project_id_idx on public.rooms(project_id);
create index room_assets_room_id_idx on public.room_assets(room_id);
create index design_briefs_room_id_idx on public.design_briefs(room_id);
create index concepts_room_id_idx on public.concepts(room_id);
create index products_retailer_id_idx on public.products(retailer_id);
create index products_category_normalized_idx on public.products(category_normalized);
create index shopping_lists_room_id_idx on public.shopping_lists(room_id);
create index product_embeddings_vector_idx on public.product_embeddings using ivfflat (vector extensions.vector_cosine_ops) with (lists = 100);

create trigger users_set_updated_at before update on public.users for each row execute function public.set_updated_at();
create trigger projects_set_updated_at before update on public.projects for each row execute function public.set_updated_at();
create trigger rooms_set_updated_at before update on public.rooms for each row execute function public.set_updated_at();
create trigger design_briefs_set_updated_at before update on public.design_briefs for each row execute function public.set_updated_at();
create trigger concepts_set_updated_at before update on public.concepts for each row execute function public.set_updated_at();
create trigger retailers_set_updated_at before update on public.retailers for each row execute function public.set_updated_at();
create trigger products_set_updated_at before update on public.products for each row execute function public.set_updated_at();
create trigger shopping_lists_set_updated_at before update on public.shopping_lists for each row execute function public.set_updated_at();
create trigger shopping_list_items_set_updated_at before update on public.shopping_list_items for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, name)
  values (new.id, coalesce(new.email, ''), new.raw_user_meta_data ->> 'name')
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_project_owner(project_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = project_id
      and p.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_room_owner(room_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.rooms r
    join public.projects p on p.id = r.project_id
    where r.id = room_id
      and p.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_design_brief_owner(design_brief_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.design_briefs b
    join public.rooms r on r.id = b.room_id
    join public.projects p on p.id = r.project_id
    where b.id = design_brief_id
      and p.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_concept_owner(concept_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.concepts c
    join public.rooms r on r.id = c.room_id
    join public.projects p on p.id = r.project_id
    where c.id = concept_id
      and p.owner_user_id = auth.uid()
  );
$$;

create or replace function public.is_shopping_list_owner(shopping_list_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.shopping_lists s
    join public.rooms r on r.id = s.room_id
    join public.projects p on p.id = r.project_id
    where s.id = shopping_list_id
      and p.owner_user_id = auth.uid()
  );
$$;

alter table public.users enable row level security;
alter table public.projects enable row level security;
alter table public.rooms enable row level security;
alter table public.room_assets enable row level security;
alter table public.room_measurements enable row level security;
alter table public.design_briefs enable row level security;
alter table public.clarifying_questions enable row level security;
alter table public.concepts enable row level security;
alter table public.concept_critiques enable row level security;
alter table public.retailers enable row level security;
alter table public.products enable row level security;
alter table public.product_dimensions enable row level security;
alter table public.product_images enable row level security;
alter table public.product_embeddings enable row level security;
alter table public.ingestion_runs enable row level security;
alter table public.shopping_lists enable row level security;
alter table public.shopping_list_items enable row level security;
alter table public.render_jobs enable row level security;
alter table public.ai_jobs enable row level security;

create policy "users can read own profile" on public.users for select using (id = auth.uid());
create policy "users can update own profile" on public.users for update using (id = auth.uid()) with check (id = auth.uid());

create policy "project owners manage projects" on public.projects for all using (owner_user_id = auth.uid()) with check (owner_user_id = auth.uid());

create policy "project owners manage rooms" on public.rooms for all using (public.is_project_owner(project_id)) with check (public.is_project_owner(project_id));
create policy "room owners manage room assets" on public.room_assets for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));
create policy "room owners manage room measurements" on public.room_measurements for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));
create policy "room owners manage design briefs" on public.design_briefs for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));
create policy "brief owners manage clarifying questions" on public.clarifying_questions for all using (public.is_design_brief_owner(design_brief_id)) with check (public.is_design_brief_owner(design_brief_id));
create policy "room owners manage concepts" on public.concepts for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));
create policy "concept owners manage critiques" on public.concept_critiques for all using (public.is_concept_owner(concept_id)) with check (public.is_concept_owner(concept_id));
create policy "room owners manage shopping lists" on public.shopping_lists for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));
create policy "shopping list owners manage items" on public.shopping_list_items for all using (public.is_shopping_list_owner(shopping_list_id)) with check (public.is_shopping_list_owner(shopping_list_id));
create policy "room owners manage render jobs" on public.render_jobs for all using (public.is_room_owner(room_id)) with check (public.is_room_owner(room_id));

create policy "authenticated users read active retailers" on public.retailers for select to authenticated using (status in ('active', 'candidate'));
create policy "authenticated users read products" on public.products for select to authenticated using (true);
create policy "authenticated users read product dimensions" on public.product_dimensions for select to authenticated using (true);
create policy "authenticated users read product images" on public.product_images for select to authenticated using (true);
create policy "authenticated users read product embeddings" on public.product_embeddings for select to authenticated using (false);
create policy "authenticated users read own ai jobs" on public.ai_jobs for select to authenticated using (true);

create policy "service role manages retailers" on public.retailers for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages products" on public.products for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages product dimensions" on public.product_dimensions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages product images" on public.product_images for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages product embeddings" on public.product_embeddings for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages ingestion runs" on public.ingestion_runs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role manages ai jobs" on public.ai_jobs for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('room-assets', 'room-assets', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']),
  ('generated-renders', 'generated-renders', false, 20971520, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy "users read own room assets"
on storage.objects for select to authenticated
using (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users upload own room assets"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users update own room assets"
on storage.objects for update to authenticated
using (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users delete own room assets"
on storage.objects for delete to authenticated
using (
  bucket_id = 'room-assets'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "users read own generated renders"
on storage.objects for select to authenticated
using (
  bucket_id = 'generated-renders'
  and (storage.foldername(name))[1] = auth.uid()::text
);

create policy "service role manages generated renders"
on storage.objects for all
using (
  bucket_id = 'generated-renders'
  and auth.role() = 'service_role'
)
with check (
  bucket_id = 'generated-renders'
  and auth.role() = 'service_role'
);
