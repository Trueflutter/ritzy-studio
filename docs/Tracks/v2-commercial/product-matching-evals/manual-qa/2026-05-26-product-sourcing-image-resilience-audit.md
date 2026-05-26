# Product Sourcing Image Resilience Audit

Date: 2026-05-26
Branch audited: `origin/main` after PR #173 merge commit `f86d902`
Verdict: safe with caveats

## What Is Covered

- Product candidate image URLs are preflighted before `sourceProductsFromConcept`.
- Non-HTTP(S), malformed, `.avif`, `.heic`, `.heif`, and `.svg` product image URLs are rejected before provider input construction.
- URLs that fetch as non-OK, non-image MIME, oversized by `content-length`/`content-range`, timeout, or network failure are stripped from the AI image evidence path.
- Rejected product images leave the product candidate text metadata intact, so one bad retailer image does not poison the whole sourcing request when enough usable image evidence remains.
- `ai_jobs.input_summary` / `output_summary` record checked, accepted, rejected, and grouped rejection reason counts.
- Provider image-download errors are defensively mapped to the catalog-refresh retry message instead of exposing a raw OpenAI/provider error.

## Operational Caveats

- The circuit breaker validates retailer URLs at runtime; it does not repair catalog data or persist image health. Ingestion-time image audit/status remains the follow-up path.
- A product whose image was stripped can still be selected from text metadata if the model judges it relevant. This is intentional for the #173 runtime hotfix, but it means image evidence quality and product selection quality are not identical.
- The preflight uses a short network fetch with strict supported image MIME checks. Some retailer CDNs that omit MIME headers, block range requests, or respond slowly may lose image evidence even if a browser can eventually display the image.
- The current automated coverage tests the helper and gate directly. It does not fully integration-test `groundProductsAction` with mocked Supabase and `sourceProductsFromConcept`.

ARCHITECT_NOTE: investor-demo safe with caveats. PR #173 prevents one bad retailer product image URL from killing Product Sourcing by stripping unsafe image evidence before `sourceProductsFromConcept`, logging grouped validation summaries, and routing residual provider download errors to catalog-refresh retry copy. Caveats: runtime-only validation, no durable catalog image health fields, text-only candidates may still be selected, strict MIME/timeout checks can drop slow or oddly configured CDN images, and full server-action integration mocking remains future test work. No schema changes, generated DB types, payment/checkout changes, deploys, production flags, or live writes are included.
