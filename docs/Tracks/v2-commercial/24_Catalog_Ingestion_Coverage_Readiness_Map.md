# 24 Catalog Ingestion Coverage Readiness Map

## Purpose

This is a docs-only routing artifact for the Catalog Ingestion lane. It summarizes the current retailer adapter coverage that exists in the repository, without approving crawler execution, live catalog writes, production flags, or runtime coupling.

This PR does not re-run retailer crawlers or dry-run commands. Coverage below is derived from merged adapter code, fixture/unit test coverage, package scripts, and prior merged dry-run notes.

## Current Guardrails

- Do not remove `dryRunOnly` for Pan Home or Homes r Us.
- Do not run broad crawls or live writes.
- Do not use private APIs, auth-only paths, checkout/cart/account/search/filter/query URLs, or `/catalog/` paths.
- Preserve Homes r Us `Crawl-delay: 10`, tiny seed discovery, and low-volume dry-run posture.
- Do not change DB/schema/generated types, UI/runtime/app actions, prompts, payment/checkout, production flags, deploys, Product Matching runtime coupling, or Catalog-First runtime coupling.
- Treat dry-run commands in this document as future controlled verification entrypoints, not commands executed by this docs-only PR.

## Coverage Snapshot

| Retailer | Adapter key | Coverage state | Live-ingestion status |
| --- | --- | --- | --- |
| Home Centre | `homecentre-ae` | Public category/product-page adapter with parser tests. | Technically has a live CLI path, but live writes remain not approved by the Catalog Ingestion lane. |
| Chattels & More | `chattels-and-more-ae` | Public category/product-page adapter with parser tests. | Technically has a live CLI path, but live writes remain not approved by the Catalog Ingestion lane. |
| Danube Home | `danubehome-ae` | Public category/product-page adapter with parser tests. | Technically has a live CLI path, but live writes remain not approved by the Catalog Ingestion lane. |
| 2XL Home | `2xlhome-ae` | Public category/product-page adapter with parser tests. | Technically has a live CLI path, but live writes remain not approved by the Catalog Ingestion lane. |
| Pan Home | `panhome-ae` | Complete for dry-run-only adapter coverage and docs routing. | Blocked by adapter `dryRunOnly` plus CLI/runner live-write guards. |
| Homes r Us | `homesrus-ae` | Complete for dry-run-only adapter coverage and docs routing. | Blocked by adapter `dryRunOnly` plus CLI/runner live-write guards. |

`Complete` in this document means complete for the current dry-run-only adapter coverage milestone. It does not mean complete for full catalog breadth, partner/feed approval, compliance signoff, controlled preview, production ingestion, or live readiness.

## Retailer Readiness Details

### Home Centre

- Source surfaces: public Home Centre UAE category pages, public product pages, schema.org Product/ItemList markup, product meta tags, and UAE English sitemap awareness from earlier verification.
- Accepted URL shapes: `https://www.homecentre.com/ae/en/c/...` category URLs and clean `https://www.homecentre.com/ae/en/buy-.../p/...` product URLs.
- Robots/terms constraints: robots notes allow general public crawling while disallowing search, cart, checkout, account, login, and parameterized paths. No official feed or API is confirmed; prefer affiliate/trade/feed access for long-term scale.
- Request pacing: adapter uses a local response cache, 20 second fetch timeout, and at least 500 ms between fetches.
- Discovery strategy: round-robin public category sampling across sofa, armchair, living, tables, TV/media, rugs, wall decor, mirrors, decor, cushions, lighting, bedroom, dining, and office category seeds.
- Parser field coverage: name, canonical URL, external product id/SKU fallback, AED price, sale price when product meta exposes it, availability, primary image, gallery images, retailer category, description, color, material, and dimensions when visible attributes or product text expose them.
- Known gaps: source freshness timestamp is not captured as a dedicated field; dimensions and material are not guaranteed on every static product page; price/sale fields vary by markup; category normalization remains existing package behavior; missing fields should stay null rather than guessed.
- Dry-run command: `pnpm --filter @ritzy-studio/ingestion ingest:homecentre:dry-run -- --limit=3`.
- Live-ingestion status: live CLI path exists, but current lane policy blocks live writes until Chief Architect/Sam explicitly approves scope, limits, rollback, ownership, and evidence requirements.

### Chattels & More

- Source surfaces: public Chattels & More category pages and schema.org Product JSON-LD on category/product pages.
- Accepted URL shapes: `https://www.chattelsandmore.com/en/category/...` category URLs and clean `https://www.chattelsandmore.com/en/<product-slug>` product URLs emitted by public JSON-LD.
- Robots/terms constraints: robots notes disallow search, checkout, cart, customer/auth, API/admin, and filter parameters; public category/product paths are the accepted surface. No official feed is confirmed.
- Request pacing: adapter uses a local response cache and at least 500 ms between fetches.
- Discovery strategy: sequential category-seed discovery over living room, tables, storage/home office, bedroom, dining, armchairs, sofas, and sofa subtype category pages.
- Parser field coverage: name, canonical URL, SKU/MPN, AED price, availability, primary image, gallery images, retailer category, description, color, material, and retailer-provided width/depth/height dimensions where JSON-LD exposes them.
- Known gaps: sale price and source freshness timestamp are not currently extracted separately; parser depends on static JSON-LD quality; some categories may expose sparse metadata; missing fields should remain null.
- Dry-run command: `pnpm --filter @ritzy-studio/ingestion ingest:chattels:dry-run -- --limit=3`.
- Live-ingestion status: live CLI path exists, but current lane policy blocks live writes until Chief Architect/Sam explicitly approves scope, limits, rollback, ownership, and evidence requirements.

### Danube Home

- Source surfaces: public Danube Home UAE category pages and product pages with product links, schema.org Product JSON-LD, page meta tags, and visible product-information attributes.
- Accepted URL shapes: `https://www.danubehome.com/ae/en/c/...` category URLs and clean `https://www.danubehome.com/ae/en/p/...` product URLs.
- Robots/terms constraints: robots notes disallow cart, checkout, account, search, and parameterized filter URLs. Use clean category/product URLs only; no official feed is confirmed.
- Request pacing: adapter uses a local response cache, 20 second fetch timeout, and at least 500 ms between fetches.
- Discovery strategy: sequential category-seed discovery across sofas, chairs, living-room tables/storage, dining, bedroom, office, rugs, lighting, mirrors/wall decor, and decor accessories.
- Parser field coverage: name, canonical URL, external SKU from URL, AED price, availability, primary image, gallery images, retailer category, description, color, material, and length/width/height dimensions where visible attribute labels expose them.
- Known gaps: sale price and source freshness timestamp are not currently extracted separately; static attribute labels vary; category normalization remains existing package behavior; missing dimensions/material should remain null.
- Dry-run command: `pnpm --filter @ritzy-studio/ingestion ingest:danube:dry-run -- --limit=3`.
- Live-ingestion status: live CLI path exists, but current lane policy blocks live writes until Chief Architect/Sam explicitly approves scope, limits, rollback, ownership, and evidence requirements.

### 2XL Home

- Source surfaces: public 2XL Home UAE category pages and Magento-style product pages with static page/meta/product data.
- Accepted URL shapes: `https://2xlhome.com/ae-en/furniture/...` and `https://2xlhome.com/ae-en/accessory/...` category URLs, plus clean `https://2xlhome.com/ae-en/<product-slug>-<numeric-code>` product URLs.
- Robots/terms constraints: robots notes allow public pages and disallow checkout, customer, review, sendfriend, internal Magento, and parameterized URLs. No official feed is confirmed.
- Request pacing: adapter uses a local response cache and at least 500 ms between fetches.
- Discovery strategy: sequential category-seed discovery over living, dining, bedroom, wall decor, mirrors, decor, lighting, rugs, office/study, sofas, and seating category pages.
- Parser field coverage: name, canonical URL, SKU, AED regular price, sale price when final price is below regular price, availability, primary image, image list when visible, retailer category hint, description, and dimensions when the product URL contains an explicit `LxDxH` pattern.
- Known gaps: color, material, and source freshness timestamp are currently null; dimensions are intentionally conservative and URL-pattern based; parser may miss gallery images not present in the static patterns; missing fields should remain null.
- Dry-run command: `pnpm --filter @ritzy-studio/ingestion ingest:2xl:dry-run -- --limit=3`.
- Live-ingestion status: live CLI path exists, but current lane policy blocks live writes until Chief Architect/Sam explicitly approves scope, limits, rollback, ownership, and evidence requirements.

### Pan Home

- Source surfaces: canonical UAE storefront, root UAE sitemap `https://www.panhomestores.com/media/uae_en_sitemap.xml`, child UAE sitemaps under `/pub/media/uae_en_sitemap_*.xml`, and clean sitemap-derived product pages.
- Accepted URL shapes: `https://www.panhomestores.com/uae_en/` storefront paths and clean `https://www.panhomestores.com/uae_en/<product-slug>-<sku>` product URLs from sitemap entries.
- Robots/terms constraints: robots notes list the UAE sitemap and disallow checkout, customer/my-account, search, catalog view, SID, and parameterized filter/sort/price URLs including `customFilters`, `priceMin`, `priceMax`, `sortKey`, and `sortDirection`. No official feed is confirmed.
- Request pacing: dry-run-only posture with at least 700 ms between fetches; keep future validation at explicit low limits from sitemap/product surfaces only.
- Discovery strategy: sitemap-first discovery using root and child UAE sitemaps, filtered to Ritzy-relevant product/category intent.
- Parser field coverage: product name, canonical URL, SKU/code, AED regular price, sale price when embedded, stock signal/available quantity when embedded, primary image, gallery images, retailer category inferred from product/category intent, dimensions, color, material, fabric/finish where exposed, and sitemap freshness timestamp.
- Known gaps: static product pages do not guarantee price fields; breadcrumb/category may need inference; rich attributes vary by page; missing fields must remain null; live writes are intentionally blocked.
- Dry-run command: `pnpm --filter @ritzy-studio/ingestion ingest:panhome:dry-run -- --limit=3`.
- Live-ingestion status: blocked by `dryRunOnly` plus CLI/runner guards. Separate approval is required before any live-write path can be considered.

### Homes r Us

- Source surfaces: public Homes r Us UAE storefront, robots file, sitemap evidence, tiny clean category seeds, and clean product pages.
- Accepted URL shapes: `https://www.homesrus.ae/en/...` public clean category and product URLs only. The proved category seed is `https://www.homesrus.ae/en/furniture/sofas-chairs/sofa/`; the proved product shape is `https://www.homesrus.ae/en/<sku>-<product-slug>/`.
- Robots/terms constraints: preserve `Crawl-delay: 10`; reject query URLs, hash URLs, `/catalog/` URLs, checkout/customer/search/API/private paths, wrong hosts, and non-`/en/` paths. Stop if future work requires private APIs, search/filter/query URLs, `/catalog/`, auth, high volume, live writes, or runtime coupling.
- Request pacing: hard 10 second fetch floor and tiny discovery. Default discovery uses at most 3 products and caps at 6 even if a larger limit is requested.
- Discovery strategy: tiny category-seed-only discovery using sofa, dining table, bedside table, and rugs/carpets public category seeds. Sitemap probing was evidence only, not broad runtime discovery.
- Parser field coverage: product name, canonical URL, SKU/code, AED regular price, sale price where embedded, availability, primary image, product images, retailer category from seed/page metadata, description, dimensions from specification text or name/URL, color, material/fabric, source freshness timestamp, and robots/terms notes.
- Known gaps: static markup is noisy and includes marketing/cart/search/private-content scripts; category normalization can be loose for some furniture subtypes; sparse price/dimension/material/availability data remains null; no broad sitemap ingestion is approved.
- Dry-run command: `pnpm --filter @ritzy-studio/ingestion ingest:homesrus:dry-run -- --limit=2`.
- Live-ingestion status: blocked by `dryRunOnly` plus CLI/runner guards. Separate approval is required before any live-write path can be considered.

## Next-Retailer Decision

Pan Home and Homes r Us are complete for dry-run-only adapter coverage and docs routing. They are not complete for live readiness. The next retailer should be selected by Chief Architect/Sam before implementation starts.

The next candidate should be a docs-first feasibility or dry-run-only adapter stage only. It should stop before implementation if the source requires private APIs, auth-only access, search/filter/query URLs, checkout/cart/account paths, `/catalog/` paths, broad crawl behavior, Cloudflare/403 workarounds, or live writes.

## Recommendation Matrix For Next Candidate

| Candidate | UAE relevance | Source availability | Robots/terms risk | Static parser feasibility | Category value | Recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| IKEA UAE | High for budget/core furniture coverage. | Public UAE category/product pages likely available; confirm clean category/product URL shapes before adapter work. | Medium; must verify robots and avoid search/filter/query/cart/account paths. | Medium; modern storefront may require fixture spike before adapter. | Strong for sofas, storage, dining, bedroom, office, lighting, rugs, and decor. | Recommended docs-first feasibility spike before dry-run adapter approval. |
| Marina Home | High for premium/luxury furniture coverage. | Public product/category pages likely available; source freshness and parser surfaces need confirmation. | Medium; must verify robots and avoid filtered/category parameter crawl. | Medium-high if static product data is exposed. | Strong premium value for living, dining, bedroom, decor, and lighting. | Recommended as a premium candidate after IKEA feasibility or in parallel only if separately routed. |
| The One | High for premium home furnishings. | Public UAE site should be assessed for clean category/product URLs. | Unknown until robots/source review. | Unknown; requires docs-only feasibility first. | Strong for living, dining, decor, textiles, and lighting. | Defer until feasibility confirms clean static surfaces. |
| West Elm UAE | High for premium aspirational catalog matching. | Public regional pages may be brand/marketplace-dependent; confirm host, UAE pricing, and product URL shape. | Unknown to medium; must avoid search/filter/query paths. | Unknown; likely requires fixture spike. | Strong premium value across target rooms. | Defer until source/robots review confirms low-risk path. |
| Crate & Barrel UAE | High for premium furniture and decor. | Public regional pages likely available; confirm clean UAE product/category pages. | Unknown to medium; must verify robots and terms posture. | Unknown; may need static fixture spike. | Strong for living, dining, bedroom, office accents, rugs, and decor. | Defer until docs-only feasibility review. |

No-go or defer criteria for any next retailer:

- `Disallow: /` or equivalent blanket block for the target public surfaces.
- Required search, filter, query, checkout, account, cart, auth-only, private API, or `/catalog/` paths.
- Cloudflare/403 behavior that would require bypassing access controls or impersonating private clients.
- Product data only available through high-volume discovery or unstable client-side/private APIs.
- Missing clean UAE pricing/currency or no reliable product URL shape.

## Required Handoff After This PR

When this coverage/readiness PR opens, update `docs/Tracks/v2-commercial/process/catalog-ingestion-agent-comms.md` with:

- PR URL
- branch
- touched files
- explicit confirmation that no crawler execution, live writes, runtime coupling, request-volume widening, or guardrail removal occurred
- recommended next safe stage after the PR merges

The final head commit should also be recorded in the PR `ARCHITECT_NOTE:` because embedding a commit hash inside the same commit that creates it is self-referential.
