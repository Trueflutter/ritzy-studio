# 29 Premium Retailer Route Verification

## Purpose

This is a docs-only route verification note for West Elm UAE and Pottery Barn UAE.

It does not approve crawler execution, adapter implementation, parser fixtures/scripts, dry-run ingestion commands, live catalog writes, production flags, DB/schema changes, runtime coupling, private API usage, or request-volume widening.

## Result

Recommendation: keep West Elm UAE and Pottery Barn UAE partner-first and do not start technical ingestion or adapter work.

Both UAE storefront domains still resolve, and older public search/index records expose category and product URL shapes. However, tiny direct checks against the official UAE domains returned closure/maintenance pages that state all stores and the website have permanently closed. That means old indexed category/product pages and affiliate listings should be treated as stale route evidence, not current ingestion surfaces.

## Retailers Reviewed

| Retailer | Official UAE URL | Route status | Recommendation |
| --- | --- | --- | --- |
| West Elm UAE | `https://www.westelm.ae/en/` | Domain resolves, but direct checks return a permanent-closure page. Older category/product index results appear stale. | Partner-first only. Do not implement adapter or fixture spike unless Alshaya/Williams-Sonoma provides a current feed or reactivation route. |
| Pottery Barn UAE | `https://www.potterybarn.ae/en/` | Domain resolves, but direct checks return a permanent-closure page. Older category/product index results appear stale. | Partner-first only. Do not implement adapter or fixture spike unless Alshaya/Williams-Sonoma provides a current feed or reactivation route. |

## Tiny Request Log

This stage used only tiny manually bounded public checks.

| Request | Purpose | Result |
| --- | --- | --- |
| `GET https://www.westelm.ae/robots.txt` | Check robots posture if safely readable. | Returned HTML closure/maintenance page, not robots rules. The page says all West Elm stores and the website have permanently closed. |
| `GET https://www.westelm.ae/en/` | Check official UAE storefront route. | Returned HTTP `503 OK` with the same closure/maintenance page. |
| `GET https://www.westelm.ae/en/shop-furniture` | Check a stale indexed category route without broad crawling. | Returned the same closure/maintenance page. |
| `GET https://www.potterybarn.ae/robots.txt` | Check robots posture if safely readable. | Returned HTML closure/maintenance page, not robots rules. The page says all Pottery Barn stores and the website have permanently closed. |
| `GET https://www.potterybarn.ae/en/` | Check official UAE storefront route. | Returned HTTP `503 OK` with the same closure/maintenance page. |
| `GET https://www.potterybarn.ae/en/shop-furniture` | Check a stale indexed category route without broad crawling. | Returned the same closure/maintenance page. |
| Public web search for official/index/affiliate evidence | Check whether public route evidence still exists without crawling. | Found stale category/product snippets, public closure coverage, Alshaya/Williams-Sonoma regional evidence, and affiliate-network references that now require partner verification. |

No crawler-scale discovery, adapter implementation, parser fixtures/scripts, package ingestion commands, dry-run ingestion commands, broad category/product traversal, live writes, private APIs, search/filter/query URLs, cart/account/checkout paths, or internal/Magento paths were executed.

## West Elm UAE

### Official URL Evidence

- Official UAE storefront: `https://www.westelm.ae/en/`
- Official UAE domain: `https://www.westelm.ae/`
- Older public index category examples:
  - `https://www.westelm.ae/en/shop-furniture/living-room-furniture/sofas-sectionals`
  - `https://www.westelm.ae/en/shop-furniture/dining-room-kitchen-furniture/dining-tables/`
  - `https://www.westelm.ae/en/shop-cushions-decor/`

### Current Route Posture

Direct checks against the official domain returned a closure/maintenance page. The same body was returned for `robots.txt`, the homepage, and a stale category URL.

The closure page says all West Elm stores and the website have permanently closed, and gives a customer-service phone number for order concerns. Because this closure page is served from the official domain, public category/product snippets should be considered stale until the retailer or operator confirms otherwise.

### Partner/Affiliate Evidence

Public search results still show historical or partner-network references for `westelm.ae`, including affiliate-network pages and older category snippets. Treat these as partner-route leads only. They are not proof that a current technical ingestion surface exists.

West Elm UAE should remain partner-first:

- request a current retailer/feed/affiliate route if the business wants this brand
- verify whether any network campaign is still active before using tracked links
- do not rely on stale category/product pages, old index snippets, or closed storefront pages

## Pottery Barn UAE

### Official URL Evidence

- Official UAE storefront: `https://www.potterybarn.ae/en/`
- Official UAE domain: `https://www.potterybarn.ae/`
- Older public index category/product examples:
  - `https://www.potterybarn.ae/en/shop-furniture`
  - `https://www.potterybarn.ae/en/shop-decor-cushions/`
  - `https://www.potterybarn.ae/en/shop-collections/`
  - `https://www.potterybarn.ae/en/buy-laguna-buffet-72`

### Current Route Posture

Direct checks against the official domain returned a closure/maintenance page. The same body was returned for `robots.txt`, the homepage, and a stale category URL.

The closure page says all Pottery Barn stores and the website have permanently closed, and gives a customer-service phone number for order concerns. Because this closure page is served from the official domain, public category/product snippets should be considered stale until the retailer or operator confirms otherwise.

### Partner/Affiliate Evidence

Public search results still show older Pottery Barn UAE product/category snippets and affiliate-network listings. These should be treated as stale or partner-gated leads, not as approval for technical ingestion.

Pottery Barn UAE should remain partner-first:

- request a current retailer/feed/affiliate route if the business wants this brand
- verify whether any network campaign is still active before using tracked links
- do not rely on stale category/product pages, old index snippets, catalogue PDFs, or closed storefront pages

## URL Allow Rules If Reopened Later

If either retailer reopens or provides a current partner-approved route, a future docs-only or dry-run-only stage should still start from a tiny allowlist:

- official UAE storefront root only
- clean category paths under `/en/`
- clean product paths under `/en/`
- officially provided feed, affiliate feed, or retailer feed URLs if contractually approved

No technical adapter should be considered until current robots/terms posture and clean category/product fetchability are proved.

## URL Reject Rules

Reject these before any future fetch:

- query strings and hash fragments
- search, filter, sort, pagination, tracking, recommendation, cart, checkout, account, customer, sign-in, order, registry mutation, payment, API, auth-only, or internal paths
- Magento/internal `/catalog/...` paths if discovered
- non-UAE domains unless separately routed
- stale indexed URLs that now resolve only to closure pages
- third-party coupon/affiliate pages as catalog source surfaces

## Partner/Commercial Route Notes

West Elm and Pottery Barn are Williams-Sonoma brands historically operated in the Middle East by Alshaya. Current public closure evidence means direct technical ingestion is not a good next step.

Acceptable future routes would be:

- explicit retailer feed
- approved affiliate feed with current campaign status
- trade/B2B feed
- partner-provided SKU export
- manual recovery for a small curated reference set, if rights and commercial status are clear

Do not treat stale public index records, coupon pages, old PDFs, or closed storefront HTML as active catalog permission.

## Stop Criteria

Stop and request Chief Architect/Sam routing if future work requires:

- private APIs, auth-only access, or access-control bypasses
- search, filter, query, sort, pagination, tracking, cart, checkout, account, order, customer, payment, or registry URLs
- internal/Magento `/catalog/...` paths
- broad stale-index recovery
- high-volume category or product crawling
- headless browser execution at ingestion scale
- live catalog writes
- Product Matching or Catalog-First runtime coupling

## Final Recommendation

Do not proceed to a West Elm UAE or Pottery Barn UAE adapter.

Both should stay partner-first until a current official feed, affiliate feed, retailer feed, trade feed, or reactivated public storefront is confirmed. The next safe Catalog Ingestion step should be Chief Architect routing to another docs-only feasibility target or to a partner/feed outreach plan, not technical ingestion for these two retailers.
