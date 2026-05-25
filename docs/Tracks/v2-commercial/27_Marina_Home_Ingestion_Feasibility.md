# 27 Marina Home Ingestion Feasibility

## Purpose

This is a docs-only feasibility result for assessing whether Marina Home UAE should become a future dry-run-only Catalog Ingestion adapter.

This file does not approve crawler execution, adapter implementation, fixtures/tests/scripts, live catalog writes, production flags, DB/schema changes, runtime coupling, private API usage, or request-volume widening.

## Feasibility Result

Recommendation: proceed to a future dry-run-only adapter PR only if Chief Architect/Sam explicitly approve it, and start with a sitemap-seeded parser spike rather than category-page crawling.

Marina Home UAE has useful public source metadata: a clean UAE market path, a public `robots.txt`, a UAE sitemap, clean category URLs, and many clean product URLs with sitemap image/title metadata and SKU-like product codes in the slug. However, direct low-volume `GET` requests for sampled category and product URLs returned the same PWA shell instead of static product details. A future adapter should therefore prove parser coverage from saved fixtures first and stop if it requires private APIs, broad crawling, search/filter/query URLs, or access-control bypasses.

## Request Log For This Docs PR

The feasibility check used a tiny public request set:

| Request | Purpose | Result |
| --- | --- | --- |
| `GET https://www.marinahomeinteriors.com/robots.txt` | Read robots rules and sitemap metadata. | `200`; robots disallow cart, checkout, customer, catalogsearch, tag, review, Magento `/catalog/...` view paths, and `?filter=` URLs. |
| `GET https://www.marinahomeinteriors.com/en-uae/` | Confirm UAE English storefront root and public response metadata. | `200`; public PWA shell, `MH_STORE_CODE=en-uae`, server `CodilarTechnologies`. |
| `HEAD https://www.marinahomeinteriors.com/en-uae/contact/` | Confirm public UAE content path without downloading another page body. | `200`; same public PWA shell metadata. |
| `GET https://www.marinahomeinteriors.com/uae_en_sitemap.xml` | Inspect advertised UAE sitemap as public source metadata. | `200`; 3,758 URL entries, `last-modified: Wed, 11 Mar 2026 22:00:02 GMT`, category URLs, product URLs, image URLs, image titles, and sitemap lastmod values. |
| `GET https://www.marinahomeinteriors.com/en-uae/seating/sofas.html` | Sample one clean sitemap-derived category URL. | `200`; returned PWA shell, not static product listing data in the downloaded HTML. |
| `GET https://www.marinahomeinteriors.com/en-uae/bromo-side-table-black-wood-orc1006.html` | Sample one clean sitemap-derived product URL. | `200`; returned PWA shell, not static product detail data in the downloaded HTML. |
| `GET https://www.marinahomeinteriors.com/client.3a2be3b103275873e1a7.js` | Inspect public PWA bundle metadata for static feasibility clues. | `200`; confirms Magento/PWA-style route resolution and product fields in client code, but this PR did not call GraphQL/API endpoints. |

No package ingestion commands, dry-run ingestion commands, crawler loops, broad category traversal, private APIs, query/filter/search URLs, cart/account/checkout paths, or live writes were executed.

## Canonical Surfaces

- Canonical host: `https://www.marinahomeinteriors.com`
- UAE English storefront root: `https://www.marinahomeinteriors.com/en-uae/`
- Robots URL: `https://www.marinahomeinteriors.com/robots.txt`
- UAE English sitemap: `https://www.marinahomeinteriors.com/uae_en_sitemap.xml`
- UAE Arabic sitemap advertised by robots: `https://www.marinahomeinteriors.com/uae_ar_sitemap.xml`
- Public media host observed in HTML and sitemap images: `https://prodmarinamedia.gumlet.io`

## Accepted URL Shapes

Future feasibility-approved discovery should be limited to clean UAE English URLs:

- Storefront root: `https://www.marinahomeinteriors.com/en-uae/`
- Category pages: `https://www.marinahomeinteriors.com/en-uae/<category>.html`
- Nested category pages: `https://www.marinahomeinteriors.com/en-uae/<category>/<subcategory>.html`
- Product pages: `https://www.marinahomeinteriors.com/en-uae/<product-slug>-<sku>.html`

Sample observed categories:

- `https://www.marinahomeinteriors.com/en-uae/seating/sofas.html`
- `https://www.marinahomeinteriors.com/en-uae/table/dining-tables.html`
- `https://www.marinahomeinteriors.com/en-uae/table/desks.html`
- `https://www.marinahomeinteriors.com/en-uae/bed/beds.html`
- `https://www.marinahomeinteriors.com/en-uae/bed/bedside-tables.html`
- `https://www.marinahomeinteriors.com/en-uae/storage/side-boards.html`
- `https://www.marinahomeinteriors.com/en-uae/storage/media-units.html`
- `https://www.marinahomeinteriors.com/en-uae/lighting/table-lamps.html`
- `https://www.marinahomeinteriors.com/en-uae/rug/handcrafted.html`
- `https://www.marinahomeinteriors.com/en-uae/decor/wall/mirrors.html`
- `https://www.marinahomeinteriors.com/en-uae/decor/fabric/cushion-covers.html`

Sample observed products:

- `https://www.marinahomeinteriors.com/en-uae/nanina-right-chaise-sectional-sofa-grey-fabric-bea2263.html`
- `https://www.marinahomeinteriors.com/en-uae/long-island-sofa-blue-fabric-bea2278.html`
- `https://www.marinahomeinteriors.com/en-uae/sunburst-dining-table-brown-wood-bjk1015.html`
- `https://www.marinahomeinteriors.com/en-uae/parq-dining-table-brown-wood-bjk1014.html`
- `https://www.marinahomeinteriors.com/en-uae/spilsbury-sideboard-black-wood-bjk1019.html`
- `https://www.marinahomeinteriors.com/en-uae/graff-chandelier-large-black-glass-cor1069.html`
- `https://www.marinahomeinteriors.com/en-uae/bromo-side-table-black-wood-orc1006.html`

## Rejected Surfaces

Reject these surfaces for any future dry-run adapter:

- Query or hash URLs.
- `?filter=` URLs and any future price, sort, pagination, search, product-id, store, or tracking parameters unless explicitly routed.
- `*/cart/*`, `*/checkout/`, `*/customer/*`, `*/catalogsearch/*`, `*/tag/*`, and `*/review/*`.
- Magento view paths disallowed by robots: `*/catalog/category/view/*` and `*/catalog/product/view/*`.
- Checkout/payment, account/auth, app-only, private API, recommendation, analytics, marketing, search-provider, or access-control surfaces.
- Non-UAE market paths unless separately routed.

## Robots And Terms Notes

`robots.txt` allows the public site generally but disallows cart, checkout, customer, catalogsearch, tag, review, Magento `/catalog/category/view/`, Magento `/catalog/product/view/`, and `?filter=` URLs. It advertises separate sitemaps for UAE, Oman, Bahrain, and Qatar English/Arabic markets.

The UAE sitemap itself contains a few disallowed `/catalog/category/view/...` entries. A future adapter must filter those out before fetch and accept only clean `/en-uae/...html` category/product URLs.

No official feed, affiliate, partner API, or production ingestion permission is confirmed in this feasibility PR. Treat legal/terms review and partner/feed approval as separate gates before any production-scale ingestion.

## Request Pacing Recommendation

For a future dry-run-only adapter PR, use:

- explicit low limits
- sitemap-seeded URL discovery, filtered before fetch
- a small hand-curated category allowlist for Ritzy-relevant surfaces
- at least a 1 second delay between public page reads
- response caching within a run
- no pagination following unless separately approved
- hard rejection of query, search, filter, cart, account, checkout, review, tag, and Magento `/catalog/...` paths before fetch

Do not broaden sitemap traversal beyond a tiny approved sample until Chief Architect/Sam approve the exact scope.

## Source-Surface Summary

Sitemap feasibility:

- The UAE sitemap returned `200` and contains 3,758 URL entries.
- It includes clean Ritzy-relevant category URLs for seating, sofas, dining tables, desks, beds, bedside tables, sideboards, media units, lighting, rugs, mirrors, wall art, cushions, and textiles.
- It includes many product URLs ending in SKU-like codes, for example `bea2263`, `bjk1015`, `cor1069`, and `orc1006`.
- Product URL slugs often expose product name, color, material/fabric, and product code.
- Sitemap image metadata exposes primary and gallery image URLs plus image titles/captions.
- Sitemap `lastmod` and the response `last-modified` header can provide source freshness signals.

Category/product page feasibility:

- Sampled clean category and product URLs returned `200`, but the downloaded HTML body was the same PWA shell and did not expose static product listing or product detail payloads.
- The public JS bundle references Magento/PWA route resolution and product concepts such as SKU, category, price range, regular/final price, special price, stock status, PDP description, and product media. This suggests client-side product data exists, but this PR did not call GraphQL/API endpoints.
- A future adapter should stop if useful fields require private APIs, auth-only endpoints, search-provider APIs, or high-volume page execution.

## Likely Parser Field Coverage

Likely available from sitemap plus clean URL parsing:

- Product name from sitemap image title or product slug.
- Canonical URL from sitemap `loc`.
- External SKU/code from product URL suffix.
- Primary image and gallery images from sitemap image entries.
- Retailer category from sitemap category seed or URL route.
- Color/material/fabric from product slug where present, with conservative nulls when absent.
- Source freshness from sitemap `lastmod`, response `last-modified`, and dry-run fetch timestamp.

Not yet proved from static page HTML:

- AED price.
- Sale price.
- Availability/stock signal.
- Full dimensions/spec table.
- Rich color/material/finish attributes beyond slug/image metadata.

These fields may exist in client-side Magento/PWA data, but a future adapter must prove access through approved public, clean, low-volume surfaces before implementation.

## Known Gaps

- Static category and product HTML samples did not expose product detail data without JavaScript.
- Direct page parsing may not be enough for prices, sale prices, availability, dimensions, or rich attributes.
- The sitemap is large enough that broad traversal would become crawler behavior; future work must use small, approved slices.
- The sitemap contains some robots-disallowed Magento `/catalog/...` URLs; future code must reject them.
- Public JS references third-party search/marketing and payment surfaces; these are not approved ingestion sources.
- Missing fields should remain null rather than inferred from unrelated scripts or marketing text.

## Go Criteria For Future Dry-Run Adapter

A future dry-run-only adapter PR can proceed only if explicitly routed and kept narrow, with:

- `dryRunOnly` enforced.
- clean URL validators for `/en-uae/...html` category and product URLs.
- hard rejection of query/search/filter/cart/account/checkout/review/tag/Magento `/catalog/...` paths.
- saved fixtures for sitemap metadata and one or two clean page samples before any parser expansion.
- a tiny hand-curated category allowlist.
- low request limits, at least 1 second pacing, and response caching.
- no live writes and no runtime/UI/Product Matching/Catalog-First coupling.
- a clear stop if price/availability/dimensions require unapproved APIs or broad page execution.

## Stop Criteria

Stop and defer to partner/feed access if a future implementation requires:

- private APIs, auth-only access, or access-control bypasses
- search/filter/query URLs
- cart, checkout, account, customer, tag, review, or payment paths
- Magento `/catalog/category/view/` or `/catalog/product/view/` paths
- high-volume sitemap/category crawling
- headless browser execution at ingestion scale
- live catalog writes
- Product Matching or Catalog-First runtime coupling

## Final Recommendation

Proceed to a separate, explicitly approved, dry-run-only adapter PR only as a controlled parser spike.

The safest first adapter shape is sitemap-first and metadata-first: accept a tiny allowlist of Ritzy-relevant sitemap category/product URLs, extract canonical URL, name, SKU/code, image gallery, category, color/material hints, and freshness where available, then leave price, sale price, availability, dimensions, and rich attributes null unless a public clean page fixture proves them without private APIs or broad execution.

## Dry-Run Adapter Scope

PR status: routed after PR #147 for dry-run-only implementation.

Implemented scope:

- Adapter key: `marinahome-ae`
- CLI aliases: `marinahome`, `marina-home`, `marinahome-ae`
- Dry-run command: `pnpm --filter @ritzy-studio/ingestion ingest:marinahome:dry-run -- --limit=2`
- Live-write status: blocked by adapter `dryRunOnly` plus existing CLI/runner guards
- Fixture coverage: one saved sitemap metadata fixture, one saved clean product shell fixture, and one saved clean category shell fixture
- Discovery posture: UAE sitemap-first and metadata-first; tiny hand-curated Ritzy-relevant category allowlist; clean `/en-uae/...html` URLs only; no query/hash/search/filter/cart/account/checkout/review/tag/Magento `/catalog/...`, private API, auth-only, broad sitemap traversal, pagination, or headless browser execution
- Parser coverage: canonical URL, product name, external SKU/code, image URLs/titles/captions, source category route, conservative color/material hints from slug metadata, and source freshness from sitemap `lastmod`

Null-field policy:

- `priceText`, `salePriceText`, `availability`, and `dimensionsText` remain `null`.
- Rich description/spec/material/finish attributes remain null unless future public clean fixtures prove them without private APIs or broad execution.

Known adapter gaps:

- No broad sitemap traversal.
- No static price, sale price, stock, or dimension extraction.
- No private Magento/PWA GraphQL/API usage.
- No headless browser execution.
- Category inference is conservative and based on clean URL route/slug metadata.

Controlled dry-run verification:

- Command: `pnpm --filter @ritzy-studio/ingestion ingest:marinahome:dry-run -- --limit=2`
- Expected behavior: dry-run summary only, using sitemap metadata plus clean product shell fetches; no Supabase client or live write path.
