# 33 The One UAE Category Normalization Gap Review

## Purpose

This records the routed dry-run-only category-normalization gap review for The One UAE.

It uses only the four existing manual seeds and saved evidence from PR #162. It does not approve live catalog writes, seed expansion, broad sitemap/category/product traversal, crawler-scale discovery, private API use, auth-only paths, search/filter/query/cart/checkout/account/order/payment/wishlist/producttag URLs, controlled preview, DB/schema/generated type changes, UI/runtime/app-action changes, prompt changes, production flags, deploys, Product Matching runtime coupling, or Catalog-First runtime coupling.

## Gap Reviewed

PR #162 found two category-normalization gaps in the approved four-seed dry-run:

| Product | Previous raw category | Previous normalized category | Issue |
| --- | --- | --- | --- |
| `RUTH dining table white - dia 100cm` | `dining` | `null` | Raw category was too broad for the normalizer. |
| `KIWIN bedside table clear` | `bedroom` | `beds` | Raw category mapped to a broad bed bucket instead of the bedside-table role. |

## Change Made

The existing The One manual seed hints were narrowed without adding seeds or broad discovery:

| Product | Updated seed category hint | Normalized category |
| --- | --- | --- |
| `RUTH dining table white - dia 100cm` | `dining table` | `dining_tables` |
| `KIWIN bedside table clear` | `nightstand` | `side_tables` |

No global category-map change was needed. No Product Matching or Catalog-First runtime behavior changed.

## Verification

Commands:

```bash
pnpm --filter @ritzy-studio/ingestion test
pnpm --filter @ritzy-studio/ingestion typecheck
pnpm --filter @ritzy-studio/ingestion exec tsx src/cli.ts theone --dry-run --limit=4
git diff --check
```

Dry-run output summary after the fix:

- adapter: `theone-ae`
- mode: `dry-run`
- seen: `4`
- failed: `0`

Category counts:

- `dining_tables`: `1`
- `lighting`: `1`
- `rugs`: `1`
- `side_tables`: `1`

Samples:

| Product | Raw category | Normalized category | Price | Availability |
| --- | --- | --- | --- | --- |
| `CASABLANCA lantern nickel - H64cm` | `lighting` | `lighting` | `AED 319` | `in stock` |
| `RUTH dining table white - dia 100cm` | `dining table` | `dining_tables` | `AED 1998` | `in stock` |
| `KIWIN bedside table clear` | `nightstand` | `side_tables` | `AED 1995` | `in stock` |
| `OREN rug white/grey - 200x300cm` | `rugs/floor covering` | `rugs` | `AED 2798` | `in stock` |

No writes were performed.

## Remaining Gaps

- Sale price nuance remains unproved across the four samples.
- Deeper specification tables remain fixture-level only.
- Partner/feed permission remains unconfirmed.
- The One remains dry-run-only/manual-seed-only.

## Stop-Rule Observations

No stop rule was encountered.

This stage did not:

- perform live catalog writes
- remove `dryRunOnly`
- add or expand seeds
- run broad sitemap/category/product traversal
- use private APIs, auth-only paths, search/filter/query/cart/checkout/account/order/payment/wishlist/producttag URLs, or internal `/catalog/...` paths
- use headless browser execution at ingestion scale
- widen request volume beyond the approved four manual seeds
- change DB/schema/generated types
- change UI/runtime/app actions
- change prompts, payment/checkout behavior, production flags, or deploys
- couple to Product Matching runtime or Catalog-First runtime

## Recommendation

The four existing The One manual seeds now normalize into useful catalog buckets for dry-run QA. Keep The One blocked from live ingestion and controlled preview until a separate Chief Architect/Sam approval routes the next exact stage.
