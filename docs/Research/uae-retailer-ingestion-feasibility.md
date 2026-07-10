# UAE Retailer Ingestion Feasibility

Research date: 2026-05-22

Scope: public, read-only feasibility check for UAE-accessible furniture and home retailers. This is not an implementation plan to run live scraping jobs; it ranks retailers for future, approved catalog adapters similar to the Home Centre path.

## Executive Recommendation

Best 5 retailers to add after Home Centre:

1. Danube Home - strongest overall candidate. It has large UAE category pages, stable `/ae/en/c/...` and `/ae/en/p/...` URLs, public prices, visible stock states, JSON-LD Product data, `__NEXT_DATA__`, rich dimensions, material, color, and very broad coverage across sofas, chairs, dining, beds, storage, decor, rugs, lighting, and office-like categories.
2. IKEA UAE - excellent catalog breadth and data quality. Category pages expose item counts and product tiles; product pages expose schema.org data, AED prices, delivery availability signals, strong image assets, dimensions, color/material/product facts, and stable SKU-like product IDs. Implementation is more bespoke because IKEA page/state structure is not the same as Magento/WooCommerce.
3. 2XL Home - strong Dubai-relevant luxury/mid-luxury coverage, already close to the Home Centre ingestion shape in this branch. Magento-style pages expose public categories, product URLs, JSON-LD/embedded product state, AED prices, SKU, stock salability, stable media URLs, and useful dimensions/material fields.
4. Chattels & More - high-quality UAE catalog with very clean product detail pages. JSON-LD/category data, public prices, SKU/item codes, stock/out-of-stock text, direct images, dimensions, material, color, fabric, frame, and legs fields are all visible. Coverage is smaller than Danube/IKEA but stylistically valuable for Ritzy.
5. Crate & Barrel UAE - high-quality premium catalog with strong product detail pages, stable SKUs, AED prices, availability, direct images, details, and dimensions. It is a Majid Al Futtaim-operated retail domain with robots disallowing checkout/search/parameter URLs but not public product pages. Category discovery should be checked more deeply before P0, but product parsing looks strong.

Near misses:

- Pan Home / Pan Emirates has useful breadth and product data, but the category implementation is ScandiPWA/GraphQL-heavy and product URL discovery is less clean from raw HTML. Good P1 after a small technical spike.
- Royal Furniture and United Furniture are feasible WooCommerce-style sources with public product pages, good prices/images, and low technical effort, but their catalog/style may be less consistently aligned with Ritzy's Dubai villa/townhouse quality bar than the top five.
- Home Box and Homes R Us have broad coverage. Home Box is currently a no-go for simple ingestion because Cloudflare returned `403 Just a moment...` for both robots.txt and category pages from server-side fetch. Homes R Us is crawlable but robots disallows parameterized URLs and `/catalog/`, and product discovery needs care.

## Scoring Rubric

Scores are 1-5, where 5 is best. Compliance risk is scored as "compatibility / low concern"; 5 means lower observed concern, 1 means high concern or blocked. Implementation effort is scored as "ease"; 5 means easiest.

| Retailer | Catalog relevance | Technical parseability | Product data richness | Stock/price visibility | Image quality/stability | Category coverage | Compliance risk | Implementation effort | Priority |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- |
| Danube Home | 5 | 5 | 5 | 5 | 5 | 5 | 4 | 4 | P0 |
| IKEA UAE | 5 | 4 | 5 | 5 | 5 | 5 | 4 | 3 | P0 |
| 2XL Home | 5 | 4 | 4 | 5 | 5 | 4 | 4 | 4 | P0 |
| Chattels & More | 4 | 5 | 5 | 5 | 5 | 3 | 4 | 5 | P0 |
| Crate & Barrel UAE | 4 | 4 | 5 | 5 | 5 | 4 | 4 | 3 | P1 |
| Pan Home / Pan Emirates | 5 | 3 | 4 | 5 | 4 | 5 | 4 | 2 | P1 |
| Royal Furniture | 4 | 4 | 3 | 4 | 4 | 4 | 4 | 4 | P1 |
| United Furniture | 4 | 4 | 4 | 5 | 4 | 4 | 4 | 4 | P1 |
| Homes R Us | 4 | 3 | 3 | 4 | 4 | 4 | 3 | 3 | P2 |
| Home Box | 5 | 1 | 3 | 4 | 4 | 5 | 2 | 1 | No-go for direct ingestion |
| West Elm UAE | 4 | 2 | 4 | 3 | 4 | 4 | 2 | 2 | P2 / recheck |
| Pottery Barn UAE | 4 | 2 | 4 | 3 | 4 | 4 | 2 | 2 | P2 / recheck |
| Marina Home | 4 | 1 | 2 | 2 | 3 | 4 | 3 | 1 | No-go for static ingestion |
| THE One | 4 | 3 | 2 | 2 | 3 | 4 | 3 | 3 | P2 |
| IDdesign UAE | 3 | 1 | 1 | 1 | 2 | 3 | 1 | 1 | No-go |
| Aura Living | 2 | 2 | 2 | 1 | 3 | 2 | 3 | 2 | No-go for now |
| La Sorogeeka | 2 | 2 | 1 | 1 | 3 | 1 | 3 | 2 | No-go for now |
| UAE Furniture / Asghar Furniture | 3 | 3 | 2 | 3 | 3 | 3 | 3 | 3 | P2 / optional |

## Retailer Findings

### Danube Home

- Website: https://www.danubehome.com/ae/en
- Relevant category URLs sampled:
  - https://www.danubehome.com/ae/en/c/furniture/sofas
  - https://www.danubehome.com/ae/en/c/furniture/sofas/corner-sofas
  - https://www.danubehome.com/ae/en/c/furniture/sofas/modular-sofas
  - https://www.danubehome.com/ae/en/furniture/sofas/3-seater-sofas
- Product URLs sampled:
  - https://www.danubehome.com/ae/en/p/form-three-seater-fabric-sofa-beige-810401102393
  - https://www.danubehome.com/ae/en/p/ella-3-seater-fabric-sofa-810302800099
  - https://www.danubehome.com/ae/en/p/oru-3-seater-fabric-sofa-light-grey-810302801547
- Data available: product name, canonical/product URL, SKU, category breadcrumbs, AED price and compare-at price, availability states such as `In Stock`, `Out Of Stock`, and low-stock text, multiple gallery images, color family/color, material, primary/secondary material, frame/leg/upholstery fields, dimensions, weight, warranty, reviews.
- Parsing method likely needed: JSON-LD Product plus `__NEXT_DATA__` / HTML field extraction. Product page JSON-LD includes Product, offers, price, currency, availability, category, color, image, and name. HTML contains richer spec tables for dimensions/material.
- Coverage notes: very broad. Search/index snippets showed 479 Danube-fulfilled sofa results on one filtered sofas page, 456 three-seater sofa results, 584 corner sofa results, 56 modular sofa results, and large search result pools. Good for living, dining, bedroom, decor, rugs, lighting, storage, and some office.
- Risks: marketplace/online-exclusive items should be filtered or tagged if Ritzy wants retailer-owned fulfillment only. Pages are large. Parameterized filters are disallowed in robots, so category seed URLs should avoid query/filter crawling.
- Robots/terms notes: https://www.danubehome.com/robots.txt returned 200. It disallows account/cart/checkout and many query/filter parameters, including `/*query=` and multiple `/*?*...` filter patterns. Public `/ae/en/c/...` and `/ae/en/p/...` paths were not observed as disallowed in the sampled robots head.
- Recommended priority: P0.

### IKEA UAE

- Website: https://www.ikea.com/ae/en
- Relevant category URLs sampled:
  - https://www.ikea.com/ae/en/cat/sofas-fu003/
  - https://www.ikea.com/ae/en/cat/sofas-armchairs-700640/
  - https://www.ikea.com/ae/en/cat/three-seat-sofas-10670/
  - https://www.ikea.com/ae/en/cat/two-seat-sofas-10668/
  - https://www.ikea.com/ae/en/cat/fabric-sofas-10661/
  - https://www.ikea.com/ae/en/cat/sofa-beds-10663/
  - https://www.ikea.com/ae/en/cat/corner-sofas-10671/
- Product URLs sampled:
  - https://www.ikea.com/ae/en/p/froesloev-3-seat-sofa-hyllie-beige-60526288/
  - https://www.ikea.com/ae/en/p/vimle-3-seat-sofa-s59433600/
  - https://www.ikea.com/ae/en/p/soervallen-3-seat-sofa-lejde-grey-black-s39314783/
- Data available: category item counts, product names, product URLs, Dhs/AED prices, previous prices, public delivery availability, review counts, color variants/options, images, schema.org graph, price specifications, SKU/product IDs, product measurements, material/care/detail content.
- Parsing method likely needed: JSON-LD Product graph plus IKEA embedded state/scripts. Category discovery may need robust product-card extraction and pagination handling (`?page=2`) or IKEA product-list state rather than simple regex alone.
- Coverage notes: excellent for the target categories. Sampled sofas category listed 242 items; three-seat sofas listed 57; fabric sofas 126; sofa-beds 65. IKEA is also strong in desks, office chairs, storage, rugs, lighting, beds, dining tables, chairs, mirrors, and decor.
- Risks: product availability can depend on selected store/delivery area. Need store/location normalization or conservative `available for delivery` parsing. Product families and variants require deduping so users do not see repeated near-identical variants.
- Robots/terms notes: https://www.ikea.com/robots.txt returned 200. The sampled head did not show public UAE category/product disallows, but the file is long and should be reviewed fully during implementation.
- Recommended priority: P0.

### 2XL Home

- Website: https://2xlhome.com/ae-en
- Relevant category URLs sampled:
  - https://2xlhome.com/ae-en/furniture/sofa-seating/sofas
  - https://2xlhome.com/ae-en/furniture/sofa-seating
  - https://2xlhome.com/ae-en/furniture/living/tables/coffee-table
  - https://2xlhome.com/ae-en/furniture/living/tables/side-table
  - https://2xlhome.com/ae-en/furniture/bedroom/beds
  - https://2xlhome.com/ae-en/furniture/dining/dining-tables
- Product URLs sampled:
  - https://2xlhome.com/ae-en/burton-1-seater-123634
  - https://2xlhome.com/ae-en/gio-3-seater-sofa-129891
- Data available: product name, URL, SKU-like product ID, AED price/sale price, stock salability (`is_salable`), JSON-LD offer availability, media/catalog image URLs, color, length/width/height fields, material/spec tables on product pages.
- Parsing method likely needed: Magento HTML + JSON-LD + embedded product state. The existing candidate adapter in this branch already uses public pages, `og:image`, `final_price`, `regular_price`, `productSku`, and `is_salable`.
- Coverage notes: sampled sofas category exposed 101 item(s); search snippets showed 103 item(s) and a range of sofa subcategories. Strong for sofa seating, tables, dining, beds, decor, lamps, wall decor, mirrors, carpets/rugs, and premium Dubai-friendly styles.
- Risks: some useful attributes are in HTML/spec text rather than JSON-LD. Category URL extraction can accidentally capture image URLs if too broad; adapter should filter product URL shape carefully. Need broad category seeds beyond the six existing in the local candidate adapter.
- Robots/terms notes: https://2xlhome.com/robots.txt returned 200 with `Allow: /`; disallows checkout, customer/internal Magento paths, `/*.php`, and `/*?` parameterized URLs.
- Recommended priority: P0.

### Chattels & More

- Website: https://www.chattelsandmore.com
- Relevant category URLs sampled:
  - https://www.chattelsandmore.com/en/category/living-room/sofas
  - https://www.chattelsandmore.com/en/category/living-room/armchairs
  - https://www.chattelsandmore.com/en/category/living-room/coffee-side-tables
  - https://www.chattelsandmore.com/en/category/bedroom/beds
  - https://www.chattelsandmore.com/en/category/dining-room/dining-tables
- Product URLs sampled:
  - https://www.chattelsandmore.com/en/lua-modular-left-arm-sofa-blue-white-soft-fabric-finish-supportive-seating-modular-living-design
  - https://www.chattelsandmore.com/en/lua-2-seater-sofa-without-armgrey
  - https://www.chattelsandmore.com/en/corner-sofa-gigi-right
  - https://www.chattelsandmore.com/en/wessex-corner-sofa-with-left-chaise-longue-off-white
  - https://www.chattelsandmore.com/amalfi-corner-sofa-off-white
- Data available: product name, breadcrumbs/category, item/SKU, AED price and sale price, stock text including `Out of Stock`, direct product images, dimensions, color, material, fabric, filling, frame, legs, seating capacity, orientation, long descriptions.
- Parsing method likely needed: JSON-LD Product from category pages for discovery plus JSON-LD/HTML specs on product pages. Existing local candidate adapter uses JSON-LD Product and schema dimensions.
- Coverage notes: sampled sofas category exposed `"numberOfItems":33`; smaller than Danube/IKEA but high quality and useful for premium/mid-premium concepts. Strong in sofas, armchairs, tables, dining, beds, accessories, lighting, rugs, and decor.
- Risks: category depth is smaller than mass retailers; should not be the only source for any category. Some pages showed product specs in visible HTML even when JSON-LD signals were weaker, so fixture coverage must include both paths.
- Robots/terms notes: https://www.chattelsandmore.com/robots.txt returned 200. It disallows search, query parameters, checkout, cart, customer/auth, API, admin, and filters; public category/product paths are not disallowed.
- Recommended priority: P0.

### Crate & Barrel UAE

- Website: https://www.crateandbarrel.me/en-ae
- Relevant category URLs sampled:
  - Product/category search results were found primarily through product pages and search; dedicated category URL discovery needs a deeper pass.
- Product URLs sampled:
  - https://www.crateandbarrel.me/en-ae/product/aris-3-piece-double-chaise-sectional-sofa/274152_CNB
  - https://www.crateandbarrel.me/en-ae/product/oceanside-90-low-sofa/333979_CNB
  - https://www.crateandbarrel.me/en-ae/product/avondale-85-sofa/402935_CNB
  - https://www.crateandbarrel.me/en-ae/product/amalie-small-space-sofa/566692_CNB
- Data available: product name, SKU, AED regular/sale prices, schema.org Offer availability, direct product images, color options/swatches, detailed materials, care, dimensions, related categories.
- Parsing method likely needed: Next.js/RSC embedded payload plus product JSON-LD. Product detail pages are rich but large; adapter should extract the `product-schema` JSON-LD and HTML dimension blocks.
- Coverage notes: premium catalog is highly relevant for Ritzy. Strong for sofas, armchairs, coffee/side tables, dining, storage, rugs, lighting, mirrors, decor, beds, and office-adjacent pieces.
- Risks: category discovery was not fully verified in raw HTML during this pass. Some product pages can be out of stock while still useful as fixtures; ingestion should filter availability. Domain is not the global `crateandbarrel.com`; keep UAE country path and AED.
- Robots/terms notes: https://www.crateandbarrel.me/robots.txt returned 200. It disallows process/login/cart/checkout/search/my-account/order-confirmation, query URLs, and some internal root/shop paths. Public product pages were not observed as disallowed.
- Recommended priority: P1, after a category discovery spike.

### Pan Home / Pan Emirates

- Website: https://www.panhomestores.com/uae_en
- Relevant category URLs sampled:
  - https://www.panhomestores.com/uae_en/furniture/sofas
  - https://www.panhomestores.com/uae_en/furniture/sofas/3-seaters
  - https://www.panhomestores.com/uae_en/modular-furniture/modular-sofa
  - https://www.panhomestores.com/uae_en/furniture/living-room
  - https://www.panhomestores.com/uae_en/furniture/sofas/corner-sofa-sets
- Product URLs sampled:
  - https://www.panhomestores.com/uae_en/bolt-3-2-seater-sofa-package-013bundle0107
  - https://www.panhomestores.com/uae_en/oblique-2-seater-sofa-grey-032aaa2000018
  - https://www.panhomestores.com/uae_en/nestled-single-seater-sofa-beige-032aaa1000012
- Data available: category item counts, prices, sale prices, stock urgency text such as `Only 1 left`, `Almost sold out`, `Out of stock`, product code, dimensions, features, care instructions, images. Search snippets showed 67 three-seater items and many modular/corner products.
- Parsing method likely needed: ScandiPWA/Magento GraphQL-like embedded JS/state or API-like endpoint discovery. Raw category HTML did not expose simple product links in the same clean way as Home Centre/2XL/Chattels, though search-indexed pages reveal the data.
- Coverage notes: broad and very relevant, with sofas, modulars, chairs, dining, bedroom, decor, rugs, mirrors, lighting, storage, and tables.
- Risks: higher implementation effort. Product discovery from category pages is the main unknown; likely needs either ScandiPWA state parsing or carefully approved API endpoint use. Avoid parameterized filters unless robots allow.
- Robots/terms notes: https://www.panhomestores.com/robots.txt returned 200. It disallows internal Magento directories, checkout/customer-like areas, and likely parameterized/internal paths; public `/uae_en/...` pages were reachable.
- Recommended priority: P1 after P0 retailers.

### Royal Furniture

- Website: https://royalfurniture.ae
- Relevant category URLs sampled:
  - https://royalfurniture.ae/product-category/sofas/
- Product URLs sampled:
  - https://royalfurniture.ae/product/ziva-6-seater-recliner-sofa-set-dark-grey/
  - https://royalfurniture.ae/product/the-relaxo-single-seater-sofa/
  - https://royalfurniture.ae/product/the-relaxo-3-seater-sofa/
  - https://royalfurniture.ae/product/the-relaxo-4-seater-sofa/
  - https://royalfurniture.ae/product/the-relaxo-12-seater-sofa/
- Data available: category product links, product names, AED prices, SKU/data layer signals, schema.org/BreadcrumbList, images, WooCommerce product structure. Dimensions/material likely available on some pages but need fixture verification by category.
- Parsing method likely needed: WooCommerce HTML, OpenGraph/meta, product cards, and possibly JSON-LD where present.
- Coverage notes: useful local coverage for living and bedroom/dining categories. Style leans broad UAE retail rather than curated premium.
- Risks: data richness appears less consistent than Danube/Chattels/Crate. Need inspect several non-sofa categories for dimensions and material completeness.
- Robots/terms notes: https://royalfurniture.ae/robots.txt returned 200. It disallows WooCommerce logs/transient uploads, wp-admin, and wpforms upload areas; public product/category pages were not disallowed.
- Recommended priority: P1.

### United Furniture

- Website: https://www.unitedfurnitureco.com
- Relevant category URLs sampled:
  - https://www.unitedfurnitureco.com/product-category/furniture/
- Product URLs sampled:
  - https://www.unitedfurnitureco.com/product/chercell-dining-chair/
  - https://www.unitedfurnitureco.com/product/caitbrook-counter-table/
  - https://www.unitedfurnitureco.com/product/cobia-chest-of-drawer/
  - https://www.unitedfurnitureco.com/product/drift-dining-bench-1-5-m/
  - https://www.unitedfurnitureco.com/product/hammis-dining-chair/
- Data available: product links, product names, AED price meta (`product:price:amount` and currency), OpenGraph availability, direct images, dimensions sections, WooCommerce/schema markup.
- Parsing method likely needed: WooCommerce category/product HTML plus OpenGraph product meta and dimension/spec sections.
- Coverage notes: useful for dining chairs/tables, storage, bedroom, sofas, and occasional furniture. Likely a good diversity extender after premium sources.
- Risks: category pages may mix all furniture; need better category seed map to avoid noisy normalization. Product count signals in raw category HTML were not reliable from the quick extraction.
- Robots/terms notes: https://www.unitedfurnitureco.com/robots.txt returned 200. It disallows WooCommerce logs/transient uploads, `add-to-cart` query URLs, and wp-admin; public products/categories are not disallowed.
- Recommended priority: P1.

### Homes R Us

- Website: https://www.homesrus.ae/en
- Relevant category URLs sampled:
  - https://www.homesrus.ae/en/furniture/living-room/sofas.html
- Product URLs sampled:
  - Category page exposed product forms with `data-product-sku`, media URLs, and add-to-cart product IDs; clean product URL extraction needs a second pass.
- Data available: public category HTML, SKU fields, AED prices in `data-price-amount`, direct media/catalog images, category navigation and product IDs.
- Parsing method likely needed: Magento HTML scraping. Product URL extraction from category cards and fixtures must be verified; product detail pages may have better JSON-LD/spec data.
- Coverage notes: appears broad for sofas, beds, dining, decor, rugs, lamps, mirrors, and tables. Search also surfaced PDF/catalog evidence with dimensions/prices, but PDFs should not be the primary ingestion path.
- Risks: robots.txt includes `Crawl-delay: 10`, disallows all URLs with query-like `*?*=*`, and disallows `/catalog/`. Need keep to clean category/product URLs and low rate. Product discovery not as clean as 2XL/Home Centre.
- Robots/terms notes: https://www.homesrus.ae/robots.txt returned 200 and contained the concerns above.
- Recommended priority: P2.

### Home Box

- Website: https://www.homeboxstores.com/ae/en
- Relevant category URLs sampled:
  - https://www.homeboxstores.com/ae/en/c/hbxfurniture-livingroom-sofasandsofasets
  - https://www.homeboxstores.com/ae/en/c/furniture-sofaandseating-sofasandsofasets
  - https://www.homeboxstores.com/ae/en/living-room-furniture
- Product URLs sampled:
  - Not verified directly in this pass because server-side fetch returned Cloudflare challenge pages.
- Data available: search-indexed snippets show very broad category navigation and public product/category coverage; prices likely visible to normal browsers. Direct fetch returned `403 Just a moment...` for both robots.txt and category page from the research environment.
- Parsing method likely needed: not feasible with simple server-side page reads. Would need a partner/feed route, approved API, or a browser-rendering/compliance review.
- Coverage notes: excellent category match, especially because it is Landmark-adjacent to Home Centre and covers living, dining, bedroom, decor, lighting, rugs, wall art, mirrors, storage, desks, and chairs.
- Risks: anti-bot blocking is a blocker. Do not implement a direct adapter that attempts to bypass Cloudflare.
- Robots/terms notes: https://www.homeboxstores.com/robots.txt returned 403 Cloudflare challenge, so robots compatibility could not be verified from this environment.
- Recommended priority: No-go for direct ingestion until partner/feed or access route exists.

### West Elm UAE

- Website: https://www.westelm.ae
- Relevant category URLs sampled:
  - https://www.westelm.ae/en/shop-furniture/living-room-furniture/sofas-sectionals
- Product URLs sampled:
  - https://www.westelm.ae/en/buy-andes-sofa
  - https://www.westelm.ae/en/buy-dewitt-leather-sofa
  - https://www.westelm.ae/en/buy-haven-loft-leather-sofa-86
  - https://www.westelm.ae/en/buy-andes-sofa-135
- Data available: search-indexed product pages show rich product copy and UAE delivery messaging. Direct fetch from this environment returned a 503 maintenance-style page for robots and product/category URLs, so price/stock/schema could not be verified live.
- Parsing method likely needed: likely HTML/JSON-LD if reachable; otherwise partner/feed route. The site is probably operated on the same regional Alshaya stack as Pottery Barn UAE.
- Coverage notes: stylistically strong for Ritzy but probably smaller and premium-priced.
- Risks: direct fetch unavailable during research. Need recheck in browser and inspect robots/terms before implementation.
- Robots/terms notes: robots.txt could not be verified because `https://www.westelm.ae/robots.txt` returned 503 maintenance HTML.
- Recommended priority: P2 / recheck.

### Pottery Barn UAE

- Website: https://www.potterybarn.ae
- Relevant category URLs sampled:
  - https://www.potterybarn.ae/en/sofas-sectionals
- Product URLs sampled:
  - https://www.potterybarn.ae/en/buy-turner-square-arm-leather-sofa-1
  - https://www.potterybarn.ae/en/buy-big-sur-square-arm-upholstered-sofa-chaise-sectional.html
  - https://www.potterybarn.ae/en/buy-pacifica-leather-sofa
  - https://www.potterybarn.ae/en/buy-pacifica-square-arm-upholstered-sofa
- Data available: search-indexed product pages show rich product descriptions, construction/material details, and dimensions-like content. Direct fetch returned 503 maintenance HTML for robots/category/product URLs, so live price/stock/schema could not be verified.
- Parsing method likely needed: likely HTML/JSON-LD if reachable; otherwise partner/feed route.
- Coverage notes: premium catalog and relevant for high-budget Ritzy concepts, but probably not enough breadth alone.
- Risks: direct fetch unavailable during research; pricing/availability may be less consistently exposed than mass retailers.
- Robots/terms notes: robots.txt could not be verified because `https://www.potterybarn.ae/robots.txt` returned 503 maintenance HTML.
- Recommended priority: P2 / recheck.

### Marina Home

- Website: https://www.marinahomeinteriors.com/en-uae
- Relevant category URLs sampled:
  - https://www.marinahomeinteriors.com/en-uae/seating/sofa.html
- Product URLs sampled:
  - https://www.marinahomeinteriors.com/en-uae/luscious-6-seater-sofa-set-u-shape-ottoman-white.html
- Data available: direct fetch returned a static shell with `Oops! JavaScript is disabled`; no useful product JSON-LD, product links, price, SKU, stock, dimensions, or images were visible in the raw HTML sampled.
- Parsing method likely needed: not feasible through static HTML. Would need browser rendering, API discovery, or partner/feed access.
- Coverage notes: highly relevant brand/style for Ritzy, but technical parseability is currently poor.
- Risks: JS-only rendering and insufficient raw page data. Do not prioritize unless a clean public data endpoint or partner route is confirmed.
- Robots/terms notes: https://www.marinahomeinteriors.com/robots.txt returned 200. It disallows cart/checkout/customer/catalogsearch/tag/review, internal catalog view paths, filter parameters, and fully disallows Bytespider. Public friendly URLs were not disallowed, but raw HTML was not useful.
- Recommended priority: No-go for static ingestion.

### THE One

- Website: https://www.theone.com
- Relevant category URLs sampled:
  - https://www.theone.com/category/living-sofas-all-sofas
- Product URLs sampled:
  - Not sampled as raw product pages in this pass.
- Data available: search-indexed category page exposes public category content and brand/category copy; product-level price/stock/dimensions were not verified.
- Parsing method likely needed: likely HTML/category scraping if product cards are server-rendered; otherwise JS/state parse.
- Coverage notes: relevant UAE home brand with sofas, tables, beds, dining, lighting, decor, and storage.
- Risks: needs a dedicated technical spike; no product-page data verified in this pass.
- Robots/terms notes: robots not verified in this pass.
- Recommended priority: P2.

### IDdesign UAE

- Website: https://www.iddesignuae.com
- Relevant category URLs sampled:
  - https://www.iddesignuae.com/collections/sofas
- Product URLs sampled:
  - Not sampled. Category URL returned a redirect shell.
- Data available: none useful from sampled category route.
- Parsing method likely needed: not feasible.
- Coverage notes: potentially relevant brand, but not suitable for direct public ingestion now.
- Risks: https://www.iddesignuae.com/robots.txt returned `Disallow: /`, which is a clear no-go for crawling/indexing.
- Robots/terms notes: robots disallows the whole site.
- Recommended priority: No-go.

### Aura Living

- Website: https://www.auraliving.com
- Relevant category URLs sampled:
  - https://www.auraliving.com/collections/sofas
- Product URLs sampled:
  - Not sampled; collections route returned 404.
- Data available: robots allows broadly and lists `https://www.leem.com/sitemap.xml`, suggesting this may be related to another commerce platform/brand, but the sampled sofa route was not valid.
- Parsing method likely needed: unknown until a valid catalog route is found.
- Coverage notes: currently not enough confirmed furniture coverage for Ritzy ingestion.
- Risks: category discovery uncertain; may not be a UAE furniture catalog in the way needed.
- Robots/terms notes: https://www.auraliving.com/robots.txt returned 200, allows all with crawl-delay 10, and blocks some named crawlers.
- Recommended priority: No-go for now.

### La Sorogeeka

- Website: https://lasorogeeka.com
- Relevant category URLs sampled:
  - https://lasorogeeka.com/collections/furniture
- Product URLs sampled:
  - Not sampled; route returned a small page titled `LSI`.
- Data available: minimal JSON-LD/site shell, no useful public catalog data found in this pass.
- Parsing method likely needed: not feasible from current public pages; likely custom/private design studio route rather than broad ecommerce catalog.
- Coverage notes: may be relevant for inspiration or bespoke luxury references, not product catalog ingestion.
- Risks: tiny or non-public catalog, unclear prices/stock/dimensions.
- Robots/terms notes: https://lasorogeeka.com/robots.txt returned 200 and disallows `/admin/`; sitemap listed. No public product catalog evidence found.
- Recommended priority: No-go for now.

### UAE Furniture / Asghar Furniture

- Website: https://www.uae-furniture.com
- Relevant category URLs sampled:
  - https://www.uae-furniture.com/shop/living-room/sectional-sofas/u-shape-11-seater-sofa/
  - https://www.uae-furniture.com/shop/living-room/sectional-sofas/blues-tufted-u-shape-sofa/
- Product URLs sampled:
  - Same as above.
- Data available: product pages indexed with AED starting prices, SKU/category metadata, and product descriptions.
- Parsing method likely needed: likely WooCommerce-style HTML/JSON-LD.
- Coverage notes: could add budget/custom sofa diversity but may be less aligned with Ritzy's trust/premium bar than the named retailers.
- Risks: product/style quality and fulfillment consistency should be reviewed before ingestion.
- Robots/terms notes: not verified in this pass.
- Recommended priority: P2 / optional only after stronger retailers.

## Recommended Adapter Sequence

1. `danubehome-ae` - broadest immediate coverage and richest product data.
2. `ikea-ae` - highest breadth and trust, but needs a slightly more bespoke parser.
3. `2xlhome-ae` - strong style fit and already partly represented by local candidate adapter code.
4. `chattels-and-more-ae` - clean parser and high-quality Dubai-relevant products.
5. `crateandbarrel-ae` - strong premium product pages; first perform category discovery spike.
6. `panhomestores-ae` - broad catalog; first perform ScandiPWA/GraphQL discovery spike.
7. `unitedfurniture-ae` - WooCommerce-style diversity extender.
8. `royalfurniture-ae` - WooCommerce-style diversity extender.
9. `homesrus-ae` - only after verifying product detail extraction and honoring crawl-delay/query constraints.

## NOT Recommended Yet

- Home Box - excellent relevance, but direct server-side reads returned Cloudflare `403 Just a moment...` for robots/category pages. Use only if a partner/feed route exists.
- Marina Home - strong brand fit, but sampled pages return a JavaScript-disabled shell with no useful product data in raw HTML.
- IDdesign UAE - robots.txt returns `Disallow: /`.
- West Elm UAE - product/category/robots fetch returned 503 maintenance HTML in this environment; recheck later or seek feed/partner route.
- Pottery Barn UAE - same 503 maintenance issue as West Elm during this pass.
- Aura Living - valid sofa/catalog routes not found.
- La Sorogeeka - not a broad public ecommerce catalog from sampled routes.
- UAE Furniture / Asghar Furniture - feasible but lower brand/trust priority; review manually before allowing into customer-facing recommendations.

## Implementation Notes

### P0: Danube Home

- Likely adapter file name: `packages/ingestion/src/adapters/danubehome.ts`
- Category URLs to start with:
  - `https://www.danubehome.com/ae/en/c/furniture/sofas`
  - `https://www.danubehome.com/ae/en/c/furniture/sofas/corner-sofas`
  - `https://www.danubehome.com/ae/en/c/furniture/sofas/modular-sofas`
  - `https://www.danubehome.com/ae/en/furniture/sofas/3-seater-sofas`
  - dining tables, dining chairs, beds, office/desks, lighting, rugs, mirrors, wall art, storage category equivalents.
- Parser strategy: extract product URLs from `__NEXT_DATA__`/category product cards; parse product JSON-LD Product for base fields; parse spec table HTML or Next state for material/color/dimensions; normalize availability from schema.org plus visible stock text.
- Normalization gaps needed: filter marketplace vs Danube Home fulfillment if required; avoid `desk lamp` normalization regression by relying on category path plus product type; normalize Danube color/material labels.
- Test fixture examples to add:
  - In-stock sofa with sale price and dimensions: `form-three-seater-fabric-sofa-beige-810401102393`
  - Out-of-stock sofa: same family or `ada-one-seater-fabric-sofa-grey-810401101401`
  - Low-stock product: `elegance-3-seater-fabric-sofa-grey-810302800266`

### P0: IKEA UAE

- Likely adapter file name: `packages/ingestion/src/adapters/ikea.ts`
- Category URLs to start with:
  - `https://www.ikea.com/ae/en/cat/sofas-fu003/`
  - `https://www.ikea.com/ae/en/cat/armchairs-16239/`
  - `https://www.ikea.com/ae/en/cat/coffee-tables-10716/`
  - `https://www.ikea.com/ae/en/cat/dining-tables-21825/`
  - `https://www.ikea.com/ae/en/cat/dining-chairs-25219/`
  - `https://www.ikea.com/ae/en/cat/beds-bm003/`
  - `https://www.ikea.com/ae/en/cat/desks-20649/`
  - `https://www.ikea.com/ae/en/cat/office-chairs-20652/`
  - `https://www.ikea.com/ae/en/cat/rugs-10653/`
  - `https://www.ikea.com/ae/en/cat/lighting-li001/`
- Parser strategy: parse category product cards and pagination; use product JSON-LD/graph for name, image, priceSpecification, currency, URL; parse product detail/measurement sections for dimensions/materials; normalize `Dhs` to `AED`.
- Normalization gaps needed: handle product families and variant IDs; store/delivery availability may be location-specific; dedupe options so one sofa family does not dominate recommendations.
- Test fixture examples to add:
  - `froesloev-3-seat-sofa-hyllie-beige-60526288`
  - `vimle-3-seat-sofa-s59433600`
  - category fixture with 242-item sofa PLP and `?page=2` pagination.

### P0: 2XL Home

- Likely adapter file name: `packages/ingestion/src/adapters/twoxl.ts` exists locally as a candidate; broaden rather than duplicate when implementation is approved.
- Category URLs to start with:
  - `https://2xlhome.com/ae-en/furniture/sofa-seating/sofas`
  - `https://2xlhome.com/ae-en/furniture/sofa-seating/living-chair`
  - `https://2xlhome.com/ae-en/furniture/living/tables/coffee-table`
  - `https://2xlhome.com/ae-en/furniture/living/tables/side-table`
  - `https://2xlhome.com/ae-en/furniture/bedroom/beds`
  - `https://2xlhome.com/ae-en/furniture/dining/dining-tables`
  - add dining chairs, rugs/carpets, lamps, mirrors, wall decor, office furniture if stable category URLs are confirmed.
- Parser strategy: Magento product/category HTML; extract product URLs with strict URL filters; parse JSON-LD Offer plus embedded `is_salable`, price box, `og:image`, and spec table.
- Normalization gaps needed: improve dimensions extraction from actual spec table, not only URL; normalize material/color; separate sofa sets from individual seats.
- Test fixture examples to add:
  - `burton-1-seater-123634`
  - `gio-3-seater-sofa-129891`
  - category fixture confirming 101+ sofa products and excluding media URLs from product URL discovery.

### P0: Chattels & More

- Likely adapter file name: `packages/ingestion/src/adapters/chattels.ts` exists locally as a candidate; broaden rather than duplicate when implementation is approved.
- Category URLs to start with:
  - `https://www.chattelsandmore.com/en/category/living-room/sofas`
  - `https://www.chattelsandmore.com/en/category/living-room/armchairs`
  - `https://www.chattelsandmore.com/en/category/living-room/coffee-side-tables`
  - `https://www.chattelsandmore.com/en/category/bedroom/beds`
  - `https://www.chattelsandmore.com/en/category/dining-room/dining-tables`
  - add dining chairs, rugs, lighting, mirrors, decor, storage if public category URLs are stable.
- Parser strategy: JSON-LD Product for category discovery and base product fields; HTML fallback for visible spec rows where JSON-LD is incomplete.
- Normalization gaps needed: split fabric/filling/frame/legs into material text; map orientation and seating capacity; filter persistent out-of-stock products.
- Test fixture examples to add:
  - `lua-modular-left-arm-sofa-blue-white-soft-fabric-finish-supportive-seating-modular-living-design`
  - `corner-sofa-gigi-right`
  - `amalfi-corner-sofa-off-white` as out-of-stock fixture.

### P1: Crate & Barrel UAE

- Likely adapter file name: `packages/ingestion/src/adapters/crateandbarrel.ts`
- Category URLs to start with:
  - Need a dedicated category discovery spike. Product pages and search-indexed URLs are verified; stable category seed URLs were not sufficiently verified in raw HTML.
- Parser strategy: parse Next/RSC `product-schema` JSON-LD for name/SKU/image/offer/availability; parse dimensions/details blocks from rendered HTML payload.
- Normalization gaps needed: handle dimensions with many sub-measurements; identify primary overall dimensions; normalize color swatches/options.
- Test fixture examples to add:
  - `aris-3-piece-double-chaise-sectional-sofa/274152_CNB`
  - `oceanside-90-low-sofa/333979_CNB`
  - `amalie-small-space-sofa/566692_CNB`

### P1: Pan Home / Pan Emirates

- Likely adapter file name: `packages/ingestion/src/adapters/panhome.ts`
- Category URLs to start with:
  - `https://www.panhomestores.com/uae_en/furniture/sofas`
  - `https://www.panhomestores.com/uae_en/furniture/sofas/3-seaters`
  - `https://www.panhomestores.com/uae_en/modular-furniture/modular-sofa`
  - `https://www.panhomestores.com/uae_en/furniture/sofas/corner-sofa-sets`
  - later: living-room, dining, bedroom, decor, rugs, lighting, storage.
- Parser strategy: first spike ScandiPWA product-list state/API endpoint. Product detail pages have useful dimensions/code/stock text, but category discovery is not simple static HTML.
- Normalization gaps needed: parse bundle/package products without double-counting child items; normalize `Almost sold out`, `Only 1 left`, `Out of stock`; extract technical specifications.
- Test fixture examples to add:
  - `bolt-3-2-seater-sofa-package-013bundle0107`
  - `oblique-2-seater-sofa-grey-032aaa2000018`
  - `nestled-single-seater-sofa-beige-032aaa1000012`

### P1: United Furniture

- Likely adapter file name: `packages/ingestion/src/adapters/unitedfurniture.ts`
- Category URLs to start with:
  - `https://www.unitedfurnitureco.com/product-category/furniture/`
  - add narrower category paths once identified from navigation/sitemap.
- Parser strategy: WooCommerce category/product HTML; OpenGraph product price/availability; JSON-LD breadcrumbs; dimension section scraping.
- Normalization gaps needed: category seed map is important because the broad furniture page mixes types; material/spec fields may be inconsistent.
- Test fixture examples to add:
  - `chercell-dining-chair`
  - `caitbrook-counter-table`
  - `cobia-chest-of-drawer`

### P1: Royal Furniture

- Likely adapter file name: `packages/ingestion/src/adapters/royalfurniture.ts`
- Category URLs to start with:
  - `https://royalfurniture.ae/product-category/sofas/`
  - add category paths for dining, bedroom, tables, storage, and decor after sitemap/nav inspection.
- Parser strategy: WooCommerce category product links; product HTML/meta/data layer for price/SKU/image; fallback dimension/spec extraction from tabs/sections.
- Normalization gaps needed: distinguish large sofa sets from individual sofas/chairs; product names may need category-based normalization.
- Test fixture examples to add:
  - `ziva-6-seater-recliner-sofa-set-dark-grey`
  - `the-relaxo-single-seater-sofa`
  - `the-relaxo-3-seater-sofa`
