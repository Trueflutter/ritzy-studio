# 32 The One UAE Multi-Category Sample QA

## Purpose

This records the routed dry-run-only The One UAE multi-category sample QA stage.

It does not approve live catalog writes, new seed expansion, broad sitemap/category/product traversal, crawler-scale discovery, private API use, auth-only paths, search/filter/query/cart/checkout/account/order/payment/wishlist/producttag URLs, headless browser execution at ingestion scale, DB/schema/generated type changes, UI/runtime/app-action changes, prompt changes, production flags, deploys, Product Matching runtime coupling, or Catalog-First runtime coupling.

## Scope Completed

- Ran the existing The One adapter from latest `main`.
- Used the existing tiny manual seed set only.
- Used `--dry-run --limit=4`.
- Captured normalized sample output, category coverage, parser gaps, and stop-rule observations.
- Did not add or expand seeds.
- Did not change adapter code or tests because this QA run did not expose a blocking deterministic parser failure.

## Dry-Run Command

```bash
pnpm --filter @ritzy-studio/ingestion exec tsx src/cli.ts theone --dry-run --limit=4
```

## Dry-Run Output Summary

- adapter: `theone-ae`
- mode: `dry-run`
- seen: `4`
- failed: `0`

Category counts:

- `beds`: `1`
- `lighting`: `1`
- `rugs`: `1`
- `uncategorized`: `1`

Samples:

| Product | Raw category | Normalized category | Price | Availability |
| --- | --- | --- | --- | --- |
| `CASABLANCA lantern nickel - H64cm` | `lighting` | `lighting` | `AED 319` | `in stock` |
| `RUTH dining table white - dia 100cm` | `dining` | `null` | `AED 1998` | `in stock` |
| `KIWIN bedside table clear` | `bedroom` | `beds` | `AED 1995` | `in stock` |
| `OREN rug white/grey - 200x300cm` | `rugs/floor covering` | `rugs` | `AED 2798` | `in stock` |

No writes were performed.

## Category Coverage Notes

The run touched the existing four manual seed categories:

- lighting
- dining
- bedroom
- rugs/floor covering

The dry-run path remains manual-seed-only. No sitemap traversal, category traversal, pagination, query/filter/search URL, or broad product discovery was introduced.

## Parser And Normalization Gaps

- Dining table parsed with raw category `dining`, but normalized category was `null`. This is a QA finding for later normalization/category mapping work; it was not fixed in this report-only PR.
- Bedroom bedside table normalized to `beds`, which may be acceptable for current broad category buckets but should be reviewed before any controlled preview.
- Sale price nuance remains unproved across the four samples.
- Deeper specification tables are still not proved beyond fixture-level parsing.

## Stop-Rule Observations

No stop rule was encountered.

This stage did not:

- perform live catalog writes
- remove `dryRunOnly`
- add seed expansion
- run broad sitemap/category/product traversal
- use private APIs, auth-only paths, search/filter/query/cart/checkout/account/order/payment/wishlist/producttag URLs, or internal `/catalog/...` paths
- use headless browser execution at ingestion scale
- widen request volume beyond the approved four manual seeds
- change DB/schema/generated types
- change UI/runtime/app actions
- change prompts, payment/checkout behavior, production flags, or deploys
- couple to Product Matching runtime or Catalog-First runtime

## Recommendation

The One UAE remains suitable for dry-run-only manual-seed QA. Before controlled preview or live ingestion, route a separate approval to address category normalization gaps, confirm sale/spec coverage with additional saved fixtures, and decide whether partner/feed access is required.
