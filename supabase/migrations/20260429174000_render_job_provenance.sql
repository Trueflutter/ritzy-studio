alter table public.render_jobs
  add column prompt_key text,
  add column product_ids uuid[] not null default '{}',
  add column input_summary jsonb not null default '{}'::jsonb;
