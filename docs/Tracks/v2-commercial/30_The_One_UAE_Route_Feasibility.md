# 30 The One UAE Route Feasibility

## Purpose

This is a docs-only route feasibility note for The One UAE.

It does not approve crawler execution, adapter implementation, parser fixtures/scripts, dry-run ingestion commands, live catalog writes, production flags, DB/schema changes, runtime coupling, private API usage, or request-volume widening.

## Feasibility Result

Recommendation: The One UAE is a good candidate for a later separately approved dry-run-only technical feasibility or fixture/parser spike.

The official public UAE storefront is readable from this environment, `robots.txt` is readable, the public sitemap exposes clean category and product URLs, category pages are fetchable, and a sampled product page exposes Product JSON-LD with SKU, AED price, availability, image, and breadcrumb/category data. A later adapter would still need explicit approval, tiny limits, saved fixtures, URL validators, and conservative parsing because the site also embeds cart/account/search surfaces and Kartmax client scripts that should not be used as ingestion surfaces.

## Official URL Evidence

- Official host: `https://www.theone.com`
- UAE storefront: `https://www.theone.com/`
- Robots: `https://www.theone.com/robots.txt`
- Sitemap: `https://www.theone.com/sitemap.xml`
- Terms: `https://www.theone.com/terms-of-service`
- Contact/support evidence: `customercare@theone.com`, `+971 600 541 007`

The storefront response sets UAE cookies and currency defaults:

- `theone_currency_code=AED`
- `theone__country_code=en-ae`
- `theone_country=en-ae`
- `theone_is_default_country=en-ae`

## Tiny Request Log

This stage used only tiny manually bounded public checks.

| Request | Purpose | Result |
| --- | --- | --- |
| `GET https://www.theone.com/robots.txt` | Check robots posture. | `200`; disallows account, orders, address book, returns, wishlist, cart, checkout, thank-you, product tags, account paths, and search. Advertises `https://www.theone.com/sitemap.xml`. |
| `GET https://www.theone.com/` | Check official UAE storefront route. | `200`; large public HTML page, UAE/AED cookie defaults, public category navigation. |
| `GET https://www.theone.com/sitemap.xml` | Check public category/product route inventory. | `200`; public sitemap with clean category and product URLs plus `lastmod` values. |
| `GET https://www.theone.com/category/living-sofas-all-sofas` | Check one clean category route. | `200`; public category HTML. |
| `GET https://www.theone.com/category/dining` | Check one clean category route. | `200`; public category HTML. |
| `GET https://www.theone.com/product/casablanca-lantern-nickel-h64cm-449686` | Check one clean product route. | `200`; public product HTML with Product JSON-LD, canonical URL, SKU, AED price, InStock availability, image, and breadcrumb categories. |
| `GET https://www.theone.com/terms-of-service` | Check terms page fetchability. | `200`; public terms page fetched, but no legal approval is implied by this docs-only route check. |

No crawler-scale discovery, adapter implementation, parser fixtures/scripts, package ingestion commands, dry-run ingestion commands, broad category/product traversal, live writes, private APIs, search/filter/query URLs, cart/account/checkout paths, or internal/Magento paths were executed.

## Robots And Terms Notes

Robots allows general public access but explicitly disallows:

- account dashboard and account paths
- order, address book, returns, wishlist
- cart and checkout
- thank-you
- product tag paths
- search

It advertises a public sitemap at `https://www.theone.com/sitemap.xml`.

The terms page is readable, but this PR does not provide legal approval, partner approval, feed approval, or production ingestion permission. Treat legal/terms review and partner/feed approval as separate gates before any production-scale ingestion.

## Category Route Findings

Clean category URL shape:

- `https://www.theone.com/category/<category-slug>`

Ritzy-relevant category examples observed in the public sitemap or navigation:

- `https://www.theone.com/category/living-sofas-all-sofas`
- `https://www.theone.com/category/living-sofas`
- `https://www.theone.com/category/living-armchairs-stools-accent-chairs-chaise-lounges`
- `https://www.theone.com/category/living-coffee-tables-accent-tables-coffee-tables`
- `https://www.theone.com/category/living-living-room-storage-tv-media-units`
- `https://www.theone.com/category/living-home-office-desks-chairs`
- `https://www.theone.com/category/dining-dining-tables`
- `https://www.theone.com/category/dining-dining-chairs`
- `https://www.theone.com/category/dining-dining-room-storage-buffets-sideboards`
- `https://www.theone.com/category/bed-bath-beds`
- `https://www.theone.com/category/bed-bath-beds-bedside-tables`
- `https://www.theone.com/category/bed-bath-dressers-mirrors-chest-of-drawers-mirrors`
- `https://www.theone.com/category/lighting-table-lamps`
- `https://www.theone.com/category/lighting-ceiling-lamps`
- `https://www.theone.com/category/home-decor-rugs`
- `https://www.theone.com/category/home-decor-mirrors`
- `https://www.theone.com/category/home-decor-wall-art-wall-prints`
- `https://www.theone.com/category/home-decor-cushions-throws-cushion-covers-inners`

Category pages are promising for a later tiny fixture spike. The public navigation also embeds category labels and subcategory routes in static HTML.

## Product Route Findings

Clean product URL shape:

- `https://www.theone.com/product/<product-slug>-<numeric-sku>`

Sample product URL:

- `https://www.theone.com/product/casablanca-lantern-nickel-h64cm-449686`

The sampled product page exposed:

- product title in `<title>` and meta tags
- canonical URL
- SKU `449686`
- Product JSON-LD
- AED price `319`
- availability `https://schema.org/InStock`
- primary image URL
- gallery image URLs in static HTML
- breadcrumb/category labels and category URLs

Additional sitemap product examples relevant to Ritzy:

- `https://www.theone.com/product/kiwin-bedside-table-clear-561435`
- `https://www.theone.com/product/ruth-dining-table-white-dia-100cm-659377`
- `https://www.theone.com/product/miyu-table-lamp-cream-h79cm-585717`
- `https://www.theone.com/product/oren-rug-white-grey-200x300cm-647001`
- `https://www.theone.com/product/claude-coffee-table-grey-brass-150x80cm-666440`
- `https://www.theone.com/product/chopin-coffee-table-black-brass-125x65cm-666461`

This is enough to justify a later fixture/parser feasibility stage, but not enough to approve adapter implementation in this PR.

## Partner/Feed Evidence

No official feed, affiliate feed, retailer feed, trade feed, or partner API is confirmed by this route check.

The site exposes business-facing pages that may be useful for commercial outreach:

- `/designerone` for an Interior Designer Programme
- `/b2b-program` for Commercial Design Projects
- `/franchisee-requests`
- `/contact-us`

These are partner-route leads only. They are not approval for ingestion or live writes.

## URL Allow Rules For A Future Spike

A future separately approved dry-run-only technical feasibility should accept only:

- `https://www.theone.com/robots.txt`
- `https://www.theone.com/sitemap.xml`
- clean category URLs under `/category/...`
- clean product URLs under `/product/...-<numeric-sku>`
- public image URLs from the proved image host if present in saved fixtures

It should start from a tiny hand-curated allowlist across sofas, dining tables, dining chairs, bedside tables, desks/chairs, lighting, rugs, mirrors, and cushions.

## URL Reject Rules

Reject these before fetch:

- query strings and hash fragments
- `/search`
- `/account-dashboard.html`
- `/my-order.html`
- `/address-book.html`
- `/return.html`
- `/wishlist.html`
- `/cart.html`
- `/checkout.html`
- `/thankyou.htm`
- `/account/`
- `/cart/`
- `/Checkout`
- `/producttag/`
- checkout, payment, order, account, cart, wishlist, search, tag, private API, and auth-only paths
- internal/Magento `/catalog/...` paths if discovered
- non-`www.theone.com` catalog hosts unless separately routed

## Request Pacing Recommendation

For any later explicitly approved dry-run-only spike:

- use explicit low limits
- start from a tiny hand-curated category/product allowlist
- use at least a 1 second delay between public page reads
- cache responses within the run
- do not broaden sitemap traversal beyond the approved slice
- stop if product data requires private APIs, search/filter/query URLs, cart/account/checkout paths, or headless browsing at scale

## Known Gaps

- No production feed or partner permission is confirmed.
- Sitemap is large enough that broad traversal would become crawler behavior.
- Category pages and product pages embed Kartmax client scripts and API base URLs; this route check did not call those surfaces.
- Product specs beyond JSON-LD need saved fixtures before parser claims.
- Sale price and stock nuance were not proved beyond the sampled Product JSON-LD.
- Source freshness is available in sitemap `lastmod`, but a future parser should preserve it explicitly.

## Stop Criteria

Stop and request Chief Architect/Sam routing if future work requires:

- private APIs, auth-only access, or access-control bypasses
- search, filter, query, sort, pagination, tracking, cart, checkout, account, order, customer, payment, wishlist, product-tag, or registry URLs
- internal/Magento `/catalog/...` paths
- broad sitemap/category/product crawling
- headless browser execution at ingestion scale
- live catalog writes
- Product Matching or Catalog-First runtime coupling

## Final Recommendation

The One UAE is route-feasible for a later dry-run-only technical feasibility stage.

Recommended next safe stage, if approved separately: a tiny dry-run-only fixture/parser spike that proves static category and product parsing from saved fixtures, with strict URL validators, low request limits, and `dryRunOnly` guards. Until then, no adapter implementation or live ingestion should proceed.
