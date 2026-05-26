# 31 The One UAE Fixture Parser Spike

## Purpose

This records the tiny dry-run-only The One UAE fixture/parser spike.

It does not approve live catalog writes, broad sitemap/category/product traversal, production adapter rollout, private API use, auth-only paths, search/filter/query/cart/checkout/account/order/payment/wishlist/producttag URLs, DB/schema/generated type changes, UI/runtime/app-action changes, prompt changes, production flags, deploys, Product Matching runtime coupling, or Catalog-First runtime coupling.

## Scope Completed

- Added dry-run-only adapter key `theone-ae` with CLI aliases `theone` and `the-one`.
- Added strict URL validators for:
  - `https://www.theone.com/robots.txt`
  - `https://www.theone.com/sitemap.xml`
  - clean `https://www.theone.com/category/...` category URLs
  - clean `https://www.theone.com/product/...-<numeric-sku>` product URLs
- Added a tiny hand-curated manual seed list only.
- Added saved fixtures for one approved clean category page shape and two approved clean product page shapes.
- Added parser tests for Product JSON-LD, SKU, AED price, availability, image extraction, canonical URL, breadcrumb categories, dimensions from product name/URL, and missing-field behavior.
- Kept the adapter `dryRunOnly: true`.

## Sample URLs

Approved product seed examples:

- `https://www.theone.com/product/casablanca-lantern-nickel-h64cm-449686`
- `https://www.theone.com/product/ruth-dining-table-white-dia-100cm-659377`
- `https://www.theone.com/product/kiwin-bedside-table-clear-561435`
- `https://www.theone.com/product/oren-rug-white-grey-200x300cm-647001`

Approved category context examples:

- `https://www.theone.com/category/lighting-table-lamps`
- `https://www.theone.com/category/dining-dining-tables`
- `https://www.theone.com/category/bed-bath-beds-bedside-tables`
- `https://www.theone.com/category/home-decor-rugs`

## Guardrails

The adapter rejects query strings, hash fragments, non-`www.theone.com` hosts, account/order/address/return/wishlist/cart/checkout/thank-you/producttag/search paths, payment/order paths, internal `/catalog/...` paths, API/rest/graphql paths, and any product URL that does not end in a numeric SKU.

Discovery uses only manual seeds. It does not broadly traverse the sitemap, categories, products, or pagination.

The fetch helper caches responses within the run and enforces at least a 1 second delay between public page fetches.

## Dry-Run Verification

Command:

```bash
pnpm --filter @ritzy-studio/ingestion exec tsx src/cli.ts theone --dry-run --limit=1
```

Observed summary:

- adapter: `theone-ae`
- mode: `dry-run`
- seen: `1`
- failed: `0`
- categoryCounts: `lighting: 1`
- sample: `CASABLANCA lantern nickel - H64cm`
- price: `AED 319`
- availability: `in stock`

No writes were performed.

## Known Gaps

- No production feed or partner permission is confirmed.
- The adapter intentionally avoids broad sitemap/category/product traversal.
- Sale price nuance and deeper specification tables need later approval and more saved fixture evidence.
- Live ingestion remains blocked.

## Recommendation

The One UAE is ready for continued dry-run-only technical evaluation with tiny limits and manual seeds. It is not ready for live ingestion or broad catalog discovery without separate Chief Architect/Sam approval.
