# F-012 Verification: Product Enrichment And Embeddings

## Scope

Implemented product metadata enrichment and text embedding support for catalog search.

This slice does not add product matching UI. F-013 owns the designer-facing product grounding workflow.

## Files Changed

- `packages/prompts/src/index.ts`
- `packages/prompts/src/product-enrichment.test.ts`
- `packages/domain/src/product-enrichment.ts`
- `packages/domain/src/product-enrichment.test.ts`
- `packages/ai/src/index.ts`
- `packages/ai/src/product-enrichment.test.ts`
- `packages/config/src/index.ts`
- `packages/db/src/types.ts`
- `supabase/migrations/20260429162000_product_enrichment_provenance.sql`
- `docs/Tracks/mvp/03_Data_Model.md`
- `.env.example`
- `README.md`

## Implementation Notes

Added:

- versioned `catalog.product_metadata_enrichment` prompt
- strict JSON schema for model-enriched metadata
- domain schema for enrichment input/output
- normalized style, color, material, and room tags
- deterministic product enrichment source hashes
- OpenAI text embedding helper
- product enrichment and embedding storage helper
- pgvector string formatting for Supabase writes
- product-level enrichment provenance columns

Product facts that must remain retailer/database truth are not returned by the enrichment schema:

- price
- stock/availability
- URL
- retailer
- SKU
- dimensions

The enrichment source hash excludes price and availability because those facts are database filters, not semantic search text. A price change should not force AI tag regeneration.

## Database Change

Added to `public.products`:

- `color_tags text[]`
- `material_tags text[]`
- `enrichment_source_hash text`
- `enrichment_model text`
- `enriched_at timestamptz`

Added index:

- `products_enriched_at_idx`

## Embedding Model

Default embedding model:

- `text-embedding-3-small`

The existing `product_embeddings.vector vector(1536)` schema remains compatible with this default model.

## Verification Commands

Passed:

- `pnpm --filter @ritzy-studio/domain test`
- `pnpm --filter @ritzy-studio/prompts test`
- `pnpm --filter @ritzy-studio/ai test`
- `pnpm --filter @ritzy-studio/ai typecheck`
- `pnpm typecheck`
- `pnpm check`

## Deferrals

- Image embeddings are deferred. Text embeddings are enough for the first product search and matching slice, while image-based similarity can be added later if cost and accuracy justify it.
- No live batch enrichment was run in this slice. F-012 implemented the enrichment/storage capability; ingestion scheduling and product matching UI come later.
