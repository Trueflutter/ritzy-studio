import assert from "node:assert/strict";

import {
  normalizeCategory,
  normalizeProductCandidate,
  parseAedPrice,
  parseDimensionsCm
} from "./normalization";

assert.equal(parseAedPrice("AED 1,299.50"), 1299.5);
assert.equal(parseAedPrice("د.إ 899"), 899);
assert.equal(parseAedPrice(null), null);

assert.deepEqual(parseDimensionsCm("W 220 x D 95 x H 78 cm"), {
  width_cm: 220,
  depth_cm: 95,
  height_cm: 78,
  diameter_cm: null
});

assert.deepEqual(parseDimensionsCm("80 x 45 x 36 cm"), {
  width_cm: 80,
  depth_cm: 45,
  height_cm: 36,
  diameter_cm: null
});

assert.equal(normalizeCategory("Living Room Sofa"), "sofas");
assert.equal(normalizeCategory("Decorative Object"), null);

const normalized = normalizeProductCandidate({
  canonicalUrl: "https://example.com/products/sofa",
  name: "  Linen   Sofa  ",
  retailerCategory: "Sofas",
  priceText: "AED 3,499",
  salePriceText: "AED 2,999",
  primaryImageUrl: "https://example.com/sofa.jpg",
  imageUrls: ["https://example.com/sofa.jpg", "https://example.com/sofa-2.jpg"],
  dimensionsText: "W 210 x D 90 x H 82 cm"
});

assert.equal(normalized.product.name, "Linen Sofa");
assert.equal(normalized.product.price_aed, 3499);
assert.equal(normalized.product.sale_price_aed, 2999);
assert.equal(normalized.product.currency, "AED");
assert.equal(normalized.product.category_normalized, "sofas");
assert.equal(normalized.product.data_confidence, "verified");
assert.equal(normalized.images.length, 2);
assert.equal(normalized.dimensions?.width_cm, 210);

console.log("normalization tests passed");
