import assert from "node:assert/strict";

import { buildProductSearchText, productEnrichmentResponseSchema } from "@ritzy-studio/domain";

import { createProductEnrichmentSourceHash, formatPgVector } from ".";

const input = {
  name: "Narissa 3-Seater Fabric Sofa",
  retailerName: "Home Centre",
  description: "Ivory fabric sofa",
  categoryRaw: "Furniture > Sofas",
  categoryNormalized: "sofas",
  color: "Ivory",
  material: null,
  priceAed: 3299,
  availability: "in stock"
};

const sameInputDifferentOrder = {
  availability: "in stock",
  priceAed: 3299,
  material: null,
  color: "Ivory",
  categoryNormalized: "sofas",
  categoryRaw: "Furniture > Sofas",
  description: "Ivory fabric sofa",
  retailerName: "Home Centre",
  name: "Narissa 3-Seater Fabric Sofa"
};

assert.equal(createProductEnrichmentSourceHash(input), createProductEnrichmentSourceHash(sameInputDifferentOrder));
assert.equal(
  createProductEnrichmentSourceHash(input),
  createProductEnrichmentSourceHash({ ...input, priceAed: 2999 })
);
assert.notEqual(
  createProductEnrichmentSourceHash(input),
  createProductEnrichmentSourceHash({ ...input, description: "Blue velvet sofa" })
);
assert.equal(formatPgVector([0.1, -2, 3.25]), "[0.1,-2,3.25]");

const enrichment = productEnrichmentResponseSchema.parse({
  normalizedCategory: "sofas",
  styleTags: ["contemporary"],
  colorTags: ["ivory"],
  materialTags: [],
  roomTags: ["living_room"],
  sourceConfidence: "estimated",
  warnings: [],
  derivedBy: "model-enriched"
});

const searchText = buildProductSearchText(input, enrichment);
assert.ok(searchText.includes("model color tags: ivory"));
assert.equal(searchText.includes("stock"), false);

console.log("product enrichment ai tests passed");
