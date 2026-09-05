import assert from "node:assert/strict";

import {
  categoryFor,
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
assert.equal(normalizeCategory("Recliners"), "armchairs");
assert.equal(normalizeCategory("https://2xlhome.com/ae-en/furniture/living/tv-media-units"), "storage");
assert.equal(normalizeCategory("https://2xlhome.com/ae-en/furniture/dining/dining-seating/dining-chair"), "chairs");
assert.equal(normalizeCategory("https://2xlhome.com/ae-en/accessory/lighting/chandeliers"), "lighting");
assert.equal(normalizeCategory("Living > Coffee & Side Tables > Coffee Tables"), "coffee_tables");
assert.equal(normalizeCategory("https://www.chattelsandmore.com/en/category/living-room/storage-and-home-office/desks"), "desks");
assert.equal(normalizeCategory("https://www.chattelsandmore.com/en/category/bedroom/nightstands"), "side_tables");
assert.equal(normalizeCategory("Decorative Object"), "decor");

// Danube's accessory tree, 2026-09-05. These labels had no needle, so 433
// usable products were invisible to every role query while decor was the
// thinnest category in the catalogue.
assert.equal(normalizeCategory("Candle Holders"), "decor");
assert.equal(normalizeCategory("LED & Lanterns"), "decor");
assert.equal(normalizeCategory("Figurines"), "decor");
assert.equal(normalizeCategory("Clocks"), "decor");
assert.equal(normalizeCategory("Bowls & Trays"), "decor");
assert.equal(normalizeCategory("Indoor Wall Lights"), "lighting");
assert.equal(normalizeCategory("Chest of Drawers"), "storage");
assert.equal(normalizeCategory("Furniture > Living Room > Shoe Racks"), "storage");
assert.equal(normalizeCategory("Serving Trolleys"), "storage");

// Order still decides: a candle-styled chandelier is a light, not an ornament,
// because the earlier "chandelier" needle wins over the appended "candle".
assert.equal(normalizeCategory("Candle Chandeliers"), "lighting");

// Left unmapped on purpose. A dining SET fills one blueprint role and leaves
// the other to buy the same chairs twice; architectural and outdoor fixtures
// are not furnishing, and mapping them to lighting would let a downlight fill
// a floor-lamp role.
assert.equal(normalizeCategory("Dining Set"), null);
assert.equal(normalizeCategory("Furniture > Dining Room > Dining Sets"), null);
assert.equal(normalizeCategory("Down Lights"), null);
assert.equal(normalizeCategory("Panel Lights"), null);
assert.equal(normalizeCategory("Garden Lights & Spike Lights"), null);
assert.equal(normalizeCategory("Wall Art"), "wall_art");
assert.equal(normalizeCategory("Rugs & Carpets"), "rugs");
assert.equal(normalizeCategory("Furniture > Living Room > TV & Media Units"), "storage");
assert.equal(normalizeCategory("Furniture > Dining Room > Chairs & Benches"), "chairs");
assert.equal(normalizeCategory("Furniture > Office > Office Desks"), "desks");
assert.equal(normalizeCategory("Furniture > Office > Office Chairs"), "office_chairs");
assert.equal(normalizeCategory("Furniture > Office > Bookcases"), "storage");
assert.equal(normalizeCategory("Household > Lighting > Floor Lamps"), "lighting");
assert.equal(normalizeCategory("Household > Lighting > Table & Desk Lamps"), "lighting");
assert.equal(normalizeCategory("Household > Wall Decor & Mirrors > Mirrors > Floor Mirrors"), "mirrors");
assert.equal(normalizeCategory("Household > Wall Decor & Mirrors > Wall Art"), "wall_art");

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

// The retailer's category can name a RANGE rather than an object. When it
// resolves to nothing, the product's own name is consulted: Danube files
// "Brayden Tall Bookcase" under "Furniture > Modular > Modular Living >
// Brayden", and the old `retailerCategory ?? name` never looked at the name
// when a category was present.
{
  const collectionShelved = normalizeProductCandidate({
    canonicalUrl: "https://www.danubehome.com/ae/en/p/brayden-tall-bookcase-wide-1",
    name: "Brayden Tall Bookcase With Glass Doors - Compact",
    retailerCategory: "Furniture > Modular > Modular Living > Brayden",
    priceText: "AED 1,299"
  } as never);
  assert.equal(collectionShelved.product.category_normalized, "storage");
  assert.equal(collectionShelved.product.category_raw, "Furniture > Modular > Modular Living > Brayden");
}

// The name fallback must not overturn a deliberate exclusion. A dining SET
// names both a table and its chairs, so consulting the name files it as one or
// the other and the shopper buys the chairs twice.
assert.equal(categoryFor("Dining Set", "Bavaria 1+2 High Dining Table Set - Cream/Beige"), null);
assert.equal(categoryFor("Dining Set", "Derin 1+8-Seater Dining Set with Swivel Chair-Grey/Beige"), null);
assert.equal(categoryFor("Down Lights", "Aria Recessed Downlight 12W Warm White"), null);
// But an UNINFORMATIVE category still falls through to the name.
assert.equal(categoryFor("Furniture > Modular > Modular Living > Brayden", "Brayden Tall Bookcase - Wide"), "storage");
assert.equal(categoryFor(null, "Aleem Persian Rug - Red - 250x350 cm"), "rugs");
// And a category that resolves is never second-guessed by the name.
assert.equal(categoryFor("Candle Holders", "Mirabella Metal Candle Holder on Walnut Table Base"), "decor");
