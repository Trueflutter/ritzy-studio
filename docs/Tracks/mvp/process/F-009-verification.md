# F-009 Verification: Product Catalog Schema And Adapter Framework

## Feature

`F-009 Product Catalog Schema And Adapter Framework`

## Scope

Implemented the ingestion package boundary, adapter contract, catalog normalization helpers, and ingestion run helper.

Boundaries touched:

- `packages/ingestion`
- `packages/db`
- `packages/domain`
- `packages/config`

## Implementation Summary

- Created `packages/ingestion`.
- Defined adapter contracts for:
  - retailer registration
  - compliance notes
  - product discovery
  - product extraction
  - raw product candidates
  - normalized product records
- Added normalization helpers for:
  - AED price extraction
  - category normalization
  - dimensions in cm
  - product confidence
  - image deduplication
- Added `runCatalogIngestion` helper:
  - upserts retailer metadata
  - creates `ingestion_runs`
  - calls adapter discovery/extraction
  - normalizes product facts
  - upserts products
  - inserts dimensions and images
  - updates ingestion run counts and status
- Confirmed schema support already exists from F-003:
  - `retailers`
  - `products`
  - `product_dimensions`
  - `product_images`
  - `product_embeddings`
  - `ingestion_runs`
  - `robots_notes`
  - `terms_notes`

## Verification Commands

Passed:

```bash
pnpm --filter @ritzy-studio/ingestion test
pnpm typecheck
pnpm check
```

## Result

Passed.

## Deferrals

- First real retailer adapter starts in F-010 with Home Centre.
- Product embeddings and AI enrichment remain deferred to F-012.
