# 25 IKEA UAE Ingestion Feasibility

## Purpose

This is a docs-only feasibility result for assessing whether IKEA UAE should become the next dry-run-only retailer adapter after Pan Home and Homes r Us.

This file does not approve crawler execution, adapter implementation, fixtures/tests/scripts, live catalog writes, production flags, DB/schema changes, runtime coupling, or request-volume widening.

## Feasibility Result

Recommendation: proceed to a future dry-run-only adapter PR only if Chief Architect/Sam explicitly approve it.

IKEA UAE appears feasible for a narrow, low-volume, clean category/product-page dry-run adapter because public UAE category pages expose product links and category-level schema.org `CollectionPage`/`ItemList` data, while public product pages expose schema.org `Product` JSON-LD with core catalog fields.

This recommendation is not approval to build the adapter in this PR, run an ingestion crawler, use IKEA internal APIs, or perform live writes.

## Request Log For This Docs PR

The feasibility check used a tiny public request set:

| Request | Purpose | Result |
| --- | --- | --- |
| `GET https://www.ikea.com/robots.txt` | Read public robots rules and advertised sitemap metadata. | `200`; robots disallow search/filter/query/cart/account/checkout/internal paths and advertise a global sitemap. |
| `HEAD https://www.ikea.com/ae/en/` | Confirm UAE English storefront root and public response metadata without downloading another page body. | `200`; public Cloudflare-served HTML surface. |
| `GET https://www.ikea.com/ae/en/cat/sofas-fu003/` | Inspect one clean category page for static product links and schema.org category/list data. | `200`; clean product links and schema.org `CollectionPage`/`ItemList` were visible. |
| `GET https://www.ikea.com/ae/en/p/glostad-3-seat-sofa-knisa-dark-grey-40573285/` | Inspect one clean product page selected from static category links. | `200`; schema.org `Product` JSON-LD and Open Graph metadata were visible. |

No crawler loops, package ingestion commands, dry-run ingestion commands, private APIs, query/filter/search URLs, cart/account/checkout paths, or live writes were executed.

## Canonical Surfaces

- Canonical host: `https://www.ikea.com`
- UAE English storefront root: `https://www.ikea.com/ae/en/`
- Global robots URL: `https://www.ikea.com/robots.txt`
- Sitemap advertised by robots: `https://www.ikea.com/sitemaps/sitemap.xml`
- Terms/customer-service surface observed in footer: `https://www.ikea.com/ae/en/customer-service/terms-conditions/`

The global sitemap was noted from robots metadata only. This PR did not request the sitemap, traverse child sitemaps, or extract URLs from sitemap content.

## Accepted URL Shapes

Future feasibility-approved discovery should be limited to clean UAE English category and product URLs:

- Category pages: `https://www.ikea.com/ae/en/cat/<category-slug>-<category-code>/`
- Product pages: `https://www.ikea.com/ae/en/p/<product-slug>-<article-number>/`
- Product pages with series/combinations may include an `s` prefix before the numeric code, for example `...-s89482830/`; this should be accepted only when the path remains a clean `/ae/en/p/` product URL.

Sample observed category:

- `https://www.ikea.com/ae/en/cat/sofas-fu003/`

Sample observed product:

- `https://www.ikea.com/ae/en/p/glostad-3-seat-sofa-knisa-dark-grey-40573285/`

## Rejected Surfaces

Reject these surfaces for any future dry-run adapter:

- Search URLs: `*/search/?q=*`, `*/search/products/?q=*`, `*/search/content/?q=*`, `*/search/all/?q=*`
- Filter, sorting, price, store, compare, product id, catalog id, and other query/parameter URLs
- Cart, shoppingcart, checkout, order, favourites, profile, account/login, and customer paths
- `/catalog/packagepopup/`, `/catalog/productAlternative/`, `/iows/`, `/retail/`, `/m3/`, `/cdn-cgi/`, fragments, navigation, recommendations, browse-history, planner/private modules, and other internal storefront paths disallowed by robots
- Private APIs, auth-only endpoints, access-control bypasses, or Cloudflare challenge workarounds

## Robots And Terms Notes

`robots.txt` allows the public site generally but disallows search, filter/sort/price/store query URLs, cart, shoppingcart, checkout, order, favourites, profile, browse-history, compare, several internal catalog paths, `/iows/`, `/retail/`, `/m3/`, `/cdn-cgi/`, fragments, navigation, and recommendation/private module paths.

The observed public pages are served through Cloudflare and include `cdn-cgi` challenge scripts. A future adapter must not bypass access controls or depend on challenge/private behavior. If normal low-volume public `GET` requests stop returning clean HTML, stop and defer to partner/feed access.

No official IKEA feed, affiliate, or partner ingestion permission is confirmed in this feasibility PR. Treat terms/legal review and partner/feed access as separate approval gates before any production-scale ingestion.

## Request Pacing Recommendation

For a future dry-run-only adapter PR, use:

- explicit low limits
- a small hand-curated category seed set
- at least a 1 second delay between public page reads
- response caching within a run
- hard rejection of query, search, filter, cart, account, checkout, and internal paths before fetch

Do not use sitemap breadth, pagination breadth, or category expansion until Chief Architect/Sam approve the exact scope.

## Source-Surface Summary

Category page feasibility:

- Public category HTML returned `200`.
- Category page exposed canonical metadata and schema.org `CollectionPage` with `ItemList` product entries.
- Category product entries included product name, clean product URL, image URL, AED price, and sale/strikethrough price in some cases.
- Category page also emitted a `next` link with `?page=2`; future adapter should not follow pagination unless separately approved because that widens request volume.

Product page feasibility:

- Public product HTML returned `200`.
- Product page exposed canonical URL, Open Graph image/title/description, `utag_data`, and schema.org `Product` JSON-LD.
- The sampled product JSON-LD included name, canonical URL, SKU/article number, MPN, AED price, availability, category, color, material, depth, width, description, image gallery, review/rating data, and seller/shipping metadata.

## Likely Parser Field Coverage

Likely available from public static HTML or JSON-LD:

- Product name
- Canonical URL
- External SKU/article number and MPN
- AED price
- Sale/strikethrough price from category `priceSpecification` where present
- Availability on product pages
- Primary image and image gallery
- Retailer category
- Description
- Width/depth and some dimensions where JSON-LD exposes them
- Color
- Material
- Source freshness from fetch timestamp only unless a future approved source provides explicit `lastmod`

## Known Gaps

- Product-page sale price may require careful parsing; category pages expose strikethrough pricing more clearly than the sampled product page.
- Full dimensions may vary by product; height/length/material detail may not always appear in JSON-LD.
- Category pages include pagination links; following them would widen request volume and should be separately approved.
- IKEA pages load commerce and availability modules; a future adapter must rely on public static HTML/JSON-LD only, not private API calls.
- Cloudflare challenge scripts are present; do not build any bypass behavior.
- Global sitemap breadth was not assessed and should not be used for broad discovery without separate routing.
- Missing fields should remain null rather than inferred from unrelated scripts.

## Go Criteria For Future Dry-Run Adapter

A future adapter PR can proceed only if explicitly routed and kept dry-run-only, with:

- clean seed-category list for Ritzy-relevant categories
- clean `/ae/en/cat/` and `/ae/en/p/` URL validation
- parser fixtures from saved category/product HTML
- no query/search/filter/cart/account/checkout/internal URL fetching
- low request limits and respectful pacing
- no live writes and no production runtime coupling

## Stop Criteria

Stop and defer to partner/feed access if a future implementation requires:

- private APIs or auth-only access
- search/filter/query URLs
- cart, checkout, account, favourites, profile, or customer paths
- `/catalog/`, `/iows/`, `/retail/`, `/m3/`, `/cdn-cgi/`, fragments, recommendations, or internal module paths
- high-volume sitemap/category crawling
- Cloudflare/access-control bypasses
- live catalog writes
- Product Matching or Catalog-First runtime coupling

## Final Recommendation

Proceed to a separate, explicitly approved, dry-run-only IKEA UAE adapter PR if Chief Architect/Sam want IKEA as the next budget/core catalog coverage candidate.

The adapter should start from a tiny seed set and saved fixtures for one category and one product page. It should not use broad sitemap discovery, pagination expansion, private APIs, or live writes.
