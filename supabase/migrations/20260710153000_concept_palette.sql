-- Structured palette extracted from the generated concept image (one vision
-- call, cached here). Product matching uses it so aesthetic coherence is scored
-- against the concept as rendered, not only against text tokens.

alter table public.concepts
  add column palette_json jsonb;
