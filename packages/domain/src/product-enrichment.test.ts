import assert from "node:assert/strict";

import {
  buildProductSearchText,
  normalizeTags,
  productEnrichmentResponseSchema
} from "./product-enrichment";

const parsed = productEnrichmentResponseSchema.parse({
  normalizedCategory: "sofas",
  styleTags: ["Modern Luxury", "warm minimalist"],
  colorTags: ["Off White"],
  materialTags: ["Polyester Fabric"],
  roomTags: ["Living Room"],
  sourceConfidence: "estimated",
  warnings: ["Color is derived from retailer title."],
  derivedBy: "model-enriched"
});

assert.deepEqual(parsed.styleTags, ["modern_luxury", "warm_minimalist"]);
assert.deepEqual(normalizeTags(["Linen", "linen", "Oak Wood"]), ["linen", "oak_wood"]);

const searchText = buildProductSearchText(
  {
    name: "Linen Sofa",
    description: null,
    categoryRaw: "Living > Sofas",
    categoryNormalized: "sofas",
    color: null,
    material: null,
    priceAed: 3499,
    availability: "in stock"
  },
  parsed
);

assert.ok(searchText.includes("name: Linen Sofa"));
assert.ok(searchText.includes("model style tags: modern_luxury, warm_minimalist"));
assert.equal(searchText.includes("price"), false);
assert.equal(searchText.includes("availability"), false);

console.log("product enrichment domain tests passed");
