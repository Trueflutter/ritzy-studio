# F-011 Verification: Additional Retailer Ingestion Adapters

## Scope

Added two more public-page retailer adapters to the ingestion package:

- `2xlhome-ae`
- `chattels-and-more-ae`

This brings the MVP catalog adapters to three total retailers:

- Home Centre UAE
- 2XL Home
- Chattels & More

## Files Changed

- `packages/ingestion/src/adapters/twoxl.ts`
- `packages/ingestion/src/adapters/twoxl.test.ts`
- `packages/ingestion/src/adapters/chattels.ts`
- `packages/ingestion/src/adapters/chattels.test.ts`
- `packages/ingestion/src/index.ts`
- `packages/ingestion/package.json`

## Implementation Notes

2XL Home:

- Uses public category pages for product URL discovery.
- Extracts Magento-style product facts from public product pages.
- Captures name, product URL, image, price, sale price, SKU, availability, and category hint.
- Emits dimensions only when the URL contains an explicit `LxDxH` pattern. This avoids misreading sofa seat counts as physical dimensions.

Chattels & More:

- Uses public category pages and schema.org product data.
- Follows `CollectionPage.mainEntity` and `ItemList.itemListElement` JSON-LD structures.
- Captures name, product URL, image, price, SKU, availability, color, material, category, and retailer-provided dimensions where available.

Both adapters include compliance notes and light request throttling.

## Live Smoke Results

2XL Home sample:

```json
{
  "url": "https://2xlhome.com/ae-en/norwalk-5-seater-129420",
  "name": "Norwalk 5 Seater Sofa",
  "price": 10695,
  "salePrice": 8490,
  "image": true,
  "category": "sofas",
  "availability": "in stock",
  "dimensions": null
}
```

Chattels & More sample:

```json
{
  "url": "https://www.chattelsandmore.com/en/thanos-5-seater-sofa-with-arm-sand",
  "name": "Thanos 5-Seater Sofa - Off White | Polyester Fabric & Pine Wood Frame",
  "price": 8750,
  "image": true,
  "category": "sofas",
  "availability": "in stock",
  "dimensions": {
    "width_cm": 102,
    "depth_cm": 390,
    "height_cm": 63,
    "source_text": "W 102 CMT x D 390 CMT x H 63 CMT"
  }
}
```

## Verification Commands

Passed:

- `pnpm --filter @ritzy-studio/ingestion test`
- `pnpm --filter @ritzy-studio/ingestion typecheck`
- live one-product smoke test for Chattels & More
- live one-product smoke test for 2XL Home
- `pnpm typecheck`
- `pnpm check`

## Deferrals

- No database schema change was needed for this slice because F-009 already created retailer/product catalog structures.
- No bulk ingestion run was performed. The slice only required adapter verification and sample records, and broad crawling remains intentionally out of scope.
- Retailer approval/feed access is still a long-term requirement before commercial-scale ingestion.
