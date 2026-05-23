import assert from "node:assert/strict";

import { classifyProductMatchEvidenceCompleteness } from "./product-matching-evidence";
import type { ProductMatchCandidate } from "./product-matching";

const completeCandidate: ProductMatchCandidate = {
  id: "30000000-0000-4000-8000-000000000000",
  name: "Complete Product",
  retailerName: "Retailer",
  canonicalUrl: "https://example.com/product",
  categoryNormalized: "sofas",
  priceAed: 1000,
  salePriceAed: null,
  availability: "in stock",
  primaryImageUrl: "https://example.com/product.jpg",
  color: "cream",
  material: "linen",
  styleTags: ["modern"],
  colorTags: ["cream"],
  materialTags: ["linen"],
  roomTags: ["living_room"],
  lastCheckedAt: "2026-05-22T00:00:00.000Z",
  dimensions: {
    widthCm: 220,
    depthCm: 95,
    heightCm: 80,
    sourceText: "220 x 95 x 80 cm"
  }
};

const complete = classifyProductMatchEvidenceCompleteness(completeCandidate);
assert.equal(complete.status, "complete");
assert.equal(complete.presentCount, 8);
assert.equal(complete.missingCount, 0);
assert.deepEqual(complete.warnings, []);

const partial = classifyProductMatchEvidenceCompleteness({
  ...completeCandidate,
  material: null,
  materialTags: [],
  styleTags: [],
  roomTags: []
});
assert.equal(partial.status, "partial");
assert.equal(partial.presentCount, 6);
assert.equal(partial.missingCount, 2);
assert.equal(partial.checks.hasMaterialSignal, false);
assert.equal(partial.checks.hasStyleOrRoomSignal, false);
assert.ok(partial.warnings.includes("Material evidence is missing."));
assert.ok(partial.warnings.includes("Style or room evidence is missing."));

const weak = classifyProductMatchEvidenceCompleteness({
  ...completeCandidate,
  priceAed: null,
  salePriceAed: null,
  availability: null,
  primaryImageUrl: null,
  color: null,
  colorTags: [],
  material: null,
  materialTags: [],
  styleTags: [],
  roomTags: [],
  dimensions: null
});
assert.equal(weak.status, "weak");
assert.equal(weak.presentCount, 1);
assert.equal(weak.missingCount, 7);
assert.equal(weak.checks.hasCanonicalUrl, true);
assert.equal(weak.checks.hasPrimaryImage, false);

console.log("product matching evidence tests passed");
