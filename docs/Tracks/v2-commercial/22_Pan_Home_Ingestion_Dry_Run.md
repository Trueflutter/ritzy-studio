# 22 Pan Home Ingestion Dry Run

## Scope

Pan Home UAE is active planned ingestion coverage for the retailer catalog lane.

This PR adds only a dry-run-capable adapter, parser fixtures, unit coverage, and CLI aliases. It does not perform catalog writes and does not mark Pan Home as an active production retailer.

## Source Surfaces

- Canonical host: `https://www.panhomestores.com/uae_en/`
- Root UAE sitemap: `https://www.panhomestores.com/media/uae_en_sitemap.xml`
- Child UAE sitemaps: `https://www.panhomestores.com/pub/media/uae_en_sitemap_*.xml`
- Product URLs: clean `/uae_en/<product-slug>-<sku>` URLs from sitemap entries only

The adapter rejects query URLs and skips checkout, account, search, catalog view, and non-product pages. It does not crawl parameterized category filters, search result pages, checkout, account, or cart surfaces.

## Robots And Terms Notes

Pan Home `robots.txt` lists the UAE sitemap and disallows checkout, customer/my-account, search, catalog view, SID, and parameterized filter/sort/price URLs such as `customFilters`, `priceMin`, `priceMax`, `sortKey`, and `sortDirection`.

No official Pan Home feed is confirmed. Treat this as controlled dry-run-only coverage until a separate approved live-ingestion PR or partner/feed arrangement exists.

## Discovered Fields

The static product surface can expose:

- product name
- canonical URL
- external SKU/code
- AED regular price and sale price where embedded in page data
- stock signal and available quantity where embedded in `window.actionName.page`
- primary image and gallery images from page data and sitemap image metadata
- retailer category inferred from relevant product slug/category intent
- dimensions from table data or product name/URL dimensions
- color, material, fabric, and finish fields where visible in spec table data
- source freshness timestamp from sitemap `lastmod`

## Known Gaps

- Static HTML does not guarantee price fields on every product page.
- Category/breadcrumb data is inferred when product page breadcrumb markup is absent.
- Rich product attributes vary by page; missing material, dimensions, or finish should remain null rather than guessed.
- Live writes are intentionally blocked for Pan Home in this PR.

## Sampled Category Coverage

Priority discovery terms cover:

- living room, sofas, coffee tables, side tables, TV/media units, consoles
- dining tables, dining chairs, dining storage, sideboards
- bedroom beds, nightstands, dressers, wardrobes
- home office desks and office chairs
- rugs and floor covering
- lighting and lamps
- mirrors and wall decor
- curtains, cushions, and other soft furnishings
- storage and decor

## Dry-Run Readiness

Pan Home is ready for controlled dry-run-only ingestion validation with a small explicit limit, for example:

`pnpm --filter @ritzy-studio/ingestion ingest:panhome:dry-run -- --limit=3`

Do not run non-dry-run Pan Home ingestion from this PR. The CLI guard rejects live Pan Home ingestion until a separate approved PR removes that guard.

## Next Retailer Note

After this PR merges, Homes r Us is the next retailer to assess in a separate PR. It should not be started here. Homes r Us requires stricter category-seed-only discovery because its `robots.txt` has `Crawl-delay: 10` and disallows query URLs.
