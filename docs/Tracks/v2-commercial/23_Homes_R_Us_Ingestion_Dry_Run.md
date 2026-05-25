# 23 Homes r Us Ingestion Dry Run

## Scope

Homes r Us UAE is active planned ingestion coverage for the retailer catalog lane.

This PR adds only a dry-run-only adapter, parser fixtures, unit coverage, and CLI aliases. It does not perform catalog writes and does not mark Homes r Us as an active production retailer.

## Source Surfaces

- Canonical host: `https://www.homesrus.ae/en/`
- Robots URL: `https://www.homesrus.ae/robots.txt`
- Sitemap index observed: `https://www.homesrus.ae/en/sitemap.xml`
- Child sitemap observed: `https://www.homesrus.ae/en/media/hru/sitemap-1-1.xml`
- Clean category seed used for proof: `https://www.homesrus.ae/en/furniture/sofas-chairs/sofa/`
- Clean product URL used for proof: `https://www.homesrus.ae/en/5121100313298-simon-3-seater-sofa-beige/`

Initial plain `curl` reads returned `405`, and reads with a bot-style user agent also returned `405`. Browser-style public `GET` requests exposed the robots file and clean category/product pages. The adapter uses public category/product pages only, with browser-style headers and a hard `Crawl-delay: 10` fetch floor.

## Robots And Stop Rules

Homes r Us `robots.txt` declares:

- `Crawl-delay: 10`
- `Disallow: *?*=*`
- `Disallow: /catalog/`
- disallows checkout, customer/account, search, sendfriend, review, vendor, SID, and other Magento/internal paths

The adapter rejects:

- query URLs
- hash URLs
- `/catalog/` URLs
- checkout/customer/search/API/private paths
- wrong hosts
- non-`/en/` paths
- non-product URLs during product extraction

If future discovery requires private APIs, search/query/filter URLs, `/catalog/` paths, auth, high-volume crawling, live writes, or runtime coupling, stop and ask Chief Architect.

## Tiny Seed Set

Default discovery uses a deliberately tiny seed set:

- `https://www.homesrus.ae/en/furniture/sofas-chairs/sofa/`
- `https://www.homesrus.ae/en/furniture/dining/dining-table/`
- `https://www.homesrus.ae/en/furniture/bedroom/bedside-tables/`
- `https://www.homesrus.ae/en/household/decor-and-furnishings/floor-coverings/rugs-carpets/`

Discovery defaults to at most 3 products and caps at 6 even if a larger limit is requested. Larger coverage or live writes require a separate explicit approval.

## Extracted Fields

The static product/category surfaces can expose:

- product name
- canonical URL
- external SKU/code
- AED regular price and sale price where embedded
- availability from schema.org and storefront event data
- primary image and product images
- retailer category from category seed and page event metadata
- product description
- dimensions from specification text or URL/name dimensions
- color from name/specification
- material/fabric where present in specifications
- source freshness timestamp for the dry-run read
- robots/terms notes

## Known Gaps

- Static category/product markup is noisy and includes marketing, cart, search, and private-content scripts; extraction intentionally stays narrow.
- Category normalization has existing taxonomy limitations and may map some furniture subtypes loosely.
- Missing price, dimensions, material, or availability remain null rather than guessed.
- This PR does not ingest from the sitemap broadly; sitemap probing is evidence only, not the runtime discovery path.

## Dry-Run Readiness

Homes r Us is ready for controlled dry-run-only validation with a small explicit limit:

`pnpm --filter @ritzy-studio/ingestion ingest:homesrus:dry-run --limit=2`

Do not run non-dry-run Homes r Us ingestion from this PR. The adapter is marked `dryRunOnly`, and CLI/runner guards reject live writes until a separate approved PR removes that guard.
