alter table public.products
  add column color_tags text[] not null default '{}',
  add column material_tags text[] not null default '{}',
  add column enrichment_source_hash text,
  add column enrichment_model text,
  add column enriched_at timestamptz;

create index products_enriched_at_idx on public.products(enriched_at);
