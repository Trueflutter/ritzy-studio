# Product Sourcing Resilience Follow-Through

Runtime impact: none. This is a docs-only follow-through note.

## Post-Merge Status

PR #173 (`fix(web): harden product sourcing image preflight`) is merged into `main` at merge commit `f86d902e7bdf648b15453ad2345de3128b27a773`.

PR #178 (`test(web): document product sourcing image resilience`) is merged into `main` at merge commit `33ad03f558558d82b80d85cc59381ea5e8a93840`.

Together, these PRs make the Product Sourcing image path operationally understandable enough for an investor-demo narrative, with clear caveats and no production-scale claim.

## What Is Protected Now

- Candidate product image URLs are preflighted before `sourceProductsFromConcept`.
- Malformed URLs, non-HTTP(S) URLs, unsupported image extensions, non-OK responses, non-image MIME responses, oversized images, timeouts, and fetch failures are rejected before they become AI image input.
- Rejected image evidence is stripped while product text/catalog metadata remains available to the sourcing prompt.
- One bad retailer image URL should not kill the whole Product Sourcing request when enough usable image-backed candidate evidence remains.
- Preflight summaries and gates are recorded in `ai_jobs.input_summary` / `ai_jobs.output_summary`.
- Residual provider image-download failures are mapped to catalog-refresh retry copy instead of raw provider errors.
- Focused helper tests cover invalid URL, unsupported extension, unsupported MIME, non-OK status, oversized image, timeout, fetch failure, image stripping, metadata retention, and gate behavior.
- A durable audit note records the current verdict: `docs/Tracks/v2-commercial/product-matching-evals/manual-qa/2026-05-26-product-sourcing-image-resilience-audit.md`.

## Remaining Risk Classes

- Runtime-only validation: catalog image health is not persisted, so the same bad retailer URL can be rechecked repeatedly until ingestion-time health tracking exists.
- Text-only selection: a candidate whose image was stripped can still be selected from product text metadata if the AI judges it relevant.
- Strict CDN behavior: CDNs that omit content-type, block range requests, return unusual image MIME, or respond slowly can lose image evidence even if a browser eventually renders the image.
- Concept image dependency: the #173 circuit breaker is for product candidate images. It does not remove the approved concept image dependency for sourcing.
- Integration coverage gap: tests exercise the helper and gate directly, but do not fully mock `groundProductsAction`, Supabase job writes, and `sourceProductsFromConcept` together.
- Production-scale unknowns: retailer image hosts may rate-limit, geo-block, redirect differently, or degrade under higher concurrency.

## Monitor Before Production Scale

Before any production-scale Product Sourcing rollout, monitor:

- `ai_jobs.input_summary.productImagePreflight.checkedCount`, `acceptedCount`, `rejectedCount`, and grouped `rejectionReasons`.
- `ai_jobs.output_summary.providerImageDownloadFailure`.
- Catalog-refresh retry message frequency for Product Sourcing attempts.
- Required-role image gate failures and `requiredRolesWithoutAcceptedImage`.
- Retailer-level rejection clustering, especially `unsupported_mime`, `timeout`, `fetch_failed`, and `too_large`.
- Selection quality for candidates that reached the prompt as text-only after image stripping.
- Latency contribution from image preflight under realistic candidate counts and retailer mix.
- Any provider-side image-download errors that escape the known defensive matcher.

## Production-Scale Follow-Ups

- Add ingestion-time image health/audit fields or a sidecar health record before scaling retailer catalogs.
- Consider caching retailer images into controlled storage or uploading provider-safe files so sourcing does not depend on retailer CDN availability at request time.
- Add integration-level server-action tests or a bounded harness for `groundProductsAction` that proves sanitized candidates are passed to `sourceProductsFromConcept`.
- Define an operator dashboard/query for retailer image rejection rates and top failing domains.
- Keep Product Matching controlled-preview execution approval-gated separately from this resilience note.

ARCHITECT_NOTE: product-sourcing resilience follow-through is safe with caveats. PR #173 provides the runtime circuit breaker for bad product candidate image URLs, and PR #178 documents and tests the post-merge confidence surface. The system is now protected against one bad retailer product image URL killing sourcing when enough usable evidence remains, but production scale still needs image-health observability, ingestion-time remediation or controlled image caching, text-only selection monitoring, and integration-level action coverage. This PR is docs-only: no runtime changes, DB/schema changes, generated types, payment/checkout changes, deploys, production flags, live sourcing, catalog ingestion, or live writes.
