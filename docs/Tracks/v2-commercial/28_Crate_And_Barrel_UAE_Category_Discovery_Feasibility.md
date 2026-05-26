# 28 Crate & Barrel UAE Category Discovery Feasibility

## Purpose

This is a docs-only feasibility note for Crate & Barrel UAE category discovery.

It does not approve crawler execution, adapter implementation, dry-run ingestion, live catalog writes, production flags, DB/schema changes, runtime coupling, private API usage, or request-volume widening.

## Feasibility Result

Recommendation: proceed only to a later dry-run-only fixture/parser spike if Chief Architect/Sam explicitly approve it, and only after robots/terms posture and clean category fetchability are confirmed in a tiny bounded check.

Crate & Barrel UAE appears useful for Ritzy coverage because public indexed pages expose clean UAE category and product URL shapes, AED pricing, sale pricing, SKU codes, gallery image references, descriptions, materials, dimensions, and related category labels. The open question is category discovery reliability: public snippets show clean category routes, but direct low-volume `curl` reads from this environment timed out or failed before response bytes were received. That means a future adapter should not be started until a follow-up fixture spike proves robots access and category/product page reads through clean public routes.

## Public Source Surfaces Reviewed

- UAE storefront: `https://www.crateandbarrel.me/en-ae`
- Site index: `https://www.crateandbarrel.me/en-ae/site-index`
- Terms page: `https://www.crateandbarrel.me/en-ae/terms-and-conditions`
- Sample category URL from public search index: `https://www.crateandbarrel.me/en-ae/c/furniture-4/home-office-furniture-1060/desks-1070`
- Sample category URL from public search index: `https://www.crateandbarrel.me/en-ae/c/furniture-4/bedroom-furniture-1000/nightstands-1020`
- Sample category URL from public search index: `https://www.crateandbarrel.me/en-ae/c/furniture-4/bedroom-furniture-1000/dressers-chests-1030`
- Sample category URL from public search index: `https://www.crateandbarrel.me/en-ae/c/furniture-4/living-room-furniture-920/coffee-accent-tables-16784`
- Sample product URL from public search index: `https://www.crateandbarrel.me/en-ae/product/amalie-small-space-sofa/566692_CNB`
- Sample product URL from public search index: `https://www.crateandbarrel.me/en-ae/product/vaquero-dining-chair/225906_CNB`

## Tiny Request Log

This feasibility pass used a tiny manually bounded check only.

| Request | Purpose | Result |
| --- | --- | --- |
| `GET https://www.crateandbarrel.me/robots.txt` | Read robots rules before any technical adapter work. | Direct `curl` failed before response bytes: first HTTP/2 internal stream error, then HTTP/1.1 receive timeout. Robots posture remains unresolved. |
| `GET https://www.crateandbarrel.me/en-ae` | Confirm UAE storefront page fetchability. | Direct HTTP/1.1 `curl` timed out with 0 bytes. Search index snippets still show the public UAE storefront and navigation taxonomy. |
| Public web search for `site:crateandbarrel.me/en-ae` category/product pages | Manually identify clean category/product URL shapes without broad crawling. | Found clean category pages, site index, terms page, and rich product pages in the public index. |

No crawler-scale discovery, adapter implementation, package ingestion commands, dry-run ingestion commands, broad category traversal, live writes, private APIs, query/filter/search URLs, cart/account/checkout paths, or internal/Magento paths were executed.

## Category Discovery Findings

Public index snippets show that Crate & Barrel UAE has category navigation relevant to Ritzy:

- Living Room Furniture
- Sofas
- Sectional Sofas
- Sofa Beds & Daybeds
- Accent Chairs
- Coffee Tables
- End & Accent Tables
- Console Tables
- TV Stands & Media Consoles
- Dining Tables
- Dining Chairs
- Buffets & Sideboards
- Bedroom Furniture
- Beds
- Dressers & Chests
- Nightstand & Bedside Tables
- Home Office Furniture
- Desks
- Office Chairs
- Shelves & Bookcases
- Rugs
- Lighting
- Wall Decor & Mirrors
- Pillows & Throws
- Window Curtains

The category URL pattern appears to be:

- `https://www.crateandbarrel.me/en-ae/c/<department-slug>-<id>/<category-slug>-<id>`
- `https://www.crateandbarrel.me/en-ae/c/<department-slug>-<id>/<category-slug>-<id>/<subcategory-slug>-<id>`

Examples from public search results:

- `https://www.crateandbarrel.me/en-ae/c/furniture-4/home-office-furniture-1060/desks-1070`
- `https://www.crateandbarrel.me/en-ae/c/furniture-4/bedroom-furniture-1000/nightstands-1020`
- `https://www.crateandbarrel.me/en-ae/c/furniture-4/bedroom-furniture-1000/dressers-chests-1030`
- `https://www.crateandbarrel.me/en-ae/c/furniture-4/living-room-furniture-920/coffee-accent-tables-16784`

Category discovery is promising but not adapter-ready because direct clean category fetchability and robots constraints were not proved in this environment.

## Product Page Parseability Findings

Public indexed product pages appear rich enough for a later fixture/parser spike. Sample product snippets exposed:

- product name
- canonical product URL
- external SKU/code ending in `_CNB`
- AED regular price
- AED sale price and discount percentage where present
- primary and gallery image labels or media references
- product description
- material/fabric/finish bullets
- dimensions in centimeters
- related category labels
- installment and loyalty text that a parser should ignore

The product URL pattern appears to be:

- `https://www.crateandbarrel.me/en-ae/product/<product-slug>/<sku>_CNB`

Examples from public search results:

- `https://www.crateandbarrel.me/en-ae/product/amalie-small-space-sofa/566692_CNB`
- `https://www.crateandbarrel.me/en-ae/product/vaquero-dining-chair/225906_CNB`
- `https://www.crateandbarrel.me/en-ae/product/lowe-navy-upholstered-dining-chair/440681_CNB`

## URL Allow Rules For A Future Spike

A later dry-run-only fixture/parser spike should accept only:

- `https://www.crateandbarrel.me/en-ae`
- `https://www.crateandbarrel.me/en-ae/site-index`
- clean category URLs under `/en-ae/c/...`
- clean product URLs under `/en-ae/product/.../<sku>_CNB`

The first fixture spike should use a tiny hand-curated allowlist, for example one page each for desks, nightstands, dining chairs, sofas, and coffee/accent tables if robots and page fetches allow them.

## URL Reject Rules

Reject these before fetch:

- query strings and hash fragments
- search URLs
- filter, sort, pagination, tracking, locale-switch, or recommendation parameters
- checkout, cart, account, sign-in, registry mutation, payment, order, customer, API, and auth-only paths
- internal platform paths, including Magento/internal `/catalog/...` shapes if discovered
- non-UAE paths unless separately routed
- non-`www.crateandbarrel.me` hosts unless a public media host is explicitly proved by fixtures

## Robots And Terms Notes

Robots posture is unresolved. Direct `robots.txt` reads from this environment failed before body bytes were received. A future adapter spike must prove `robots.txt` access and accepted/disallowed path rules before fetching category or product pages.

The public terms page is indexed at `https://www.crateandbarrel.me/en-ae/terms-and-conditions`, but this PR did not fetch or parse it. Treat legal/terms review and partner/feed approval as separate gates before any production-scale ingestion.

## Request Pacing Recommendation

For any future explicitly approved dry-run-only spike:

- use explicit low limits
- start from a tiny hand-curated category allowlist
- use at least a 1 second delay between public page reads
- cache responses within the run
- stop immediately if `robots.txt` cannot be read, clean category pages cannot be fetched, or product data requires private APIs or search/filter/query URLs
- do not broaden discovery from the site index or category navigation without separate approval

## Known Gaps

- Direct `robots.txt` and storefront fetches timed out from this environment.
- Clean category-page fetchability is not proved.
- Category discovery appears strong from public snippets and site index evidence, but needs direct clean fixture proof before adapter work.
- Product detail parseability appears strong from public snippets, but needs saved fixtures before parser implementation.
- Availability/stock signal was not proved from snippets.
- Source freshness timestamp was not proved.
- No sitemap, official feed, partner API, or production ingestion permission is confirmed.

## Stop Criteria

Stop and request Chief Architect/Sam routing if future work requires:

- private APIs, auth-only access, or access-control bypasses
- search, filter, query, sort, pagination, tracking, cart, checkout, account, order, customer, payment, or registry mutation URLs
- internal/Magento `/catalog/...` paths
- high-volume category or site-index crawling
- headless browser execution at ingestion scale
- live catalog writes
- Product Matching or Catalog-First runtime coupling

## Final Recommendation

Crate & Barrel UAE is a good next premium candidate, but not ready for adapter implementation from this docs-only pass.

Recommended next safe stage, if approved separately: a dry-run-only fixture/parser spike that first proves robots access and clean category/product page fetchability using a tiny hand-curated allowlist. If robots or clean category fetches remain inaccessible, defer to partner/feed access rather than broad crawling or private API work.
