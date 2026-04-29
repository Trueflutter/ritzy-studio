# F-010 Verification: First Retailer Ingestion Adapter

## Feature

`F-010 First Retailer Ingestion Adapter`

## Scope

Implemented the first retailer ingestion adapter for Home Centre UAE.

Boundaries touched:

- `packages/ingestion`
- `packages/db`
- `packages/domain`

## Implementation Summary

- Added `homecentre-ae` adapter.
- Lightly probed public Home Centre UAE surfaces:
  - `robots.txt`
  - UAE sitemap index
  - furniture category page
  - sofa category page
  - product page JSON-LD and product meta tags
- Adapter discovers product URLs from:
  - category-page schema.org Product/ItemList markup
  - product links on public category pages
- Adapter extracts product facts from:
  - schema.org Product JSON-LD
  - Open Graph/product meta tags
- Captured fields where available:
  - product name
  - category
  - product image URL
  - price
  - currency
  - colour
  - product URL
  - availability
  - external product id
- Added light request cache and 500ms per-request throttle.
- Added adapter unit tests.

## Compliance Notes

Home Centre `robots.txt` allows general crawling and lists UAE English product/category sitemaps. It disallows search, cart, checkout, account, login, and multiple parameterized URL paths.

MVP adapter posture:

- use only public category/product pages
- avoid search URLs and blocked paths
- keep rate low
- store robots/terms notes in retailer metadata
- prefer an approved affiliate/trade/feed route if Home Centre or Landmark Group grants access later

## Verification Commands

Passed:

```bash
pnpm --filter @ritzy-studio/ingestion test
pnpm typecheck
pnpm check
```

Live one-product smoke test:

```json
{
  "url": "https://www.homecentre.com/ae/en/buy-narissa-3-seater-fabric-sofa/p/168425236",
  "name": "Narissa 3-Seater Fabric Sofa",
  "price": 3299,
  "image": true,
  "category": "sofas",
  "availability": "in stock"
}
```

## Result

Passed.

## Deferrals

- Full scheduled ingestion UI/admin runner is deferred until after additional adapters.
- Dimensions are captured only when present in page text/name/URL or structured data; the tested Home Centre sofa product exposed colour but not dimensions in schema.org Product.
