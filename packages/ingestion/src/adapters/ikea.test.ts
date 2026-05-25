import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isCleanIkeaCategoryUrl,
  isCleanIkeaProductUrl,
  parseIkeaCategoryProducts,
  parseIkeaProductHtml,
  parseIkeaProductUrls
} from "./ikea";

const fixturesDir = join(import.meta.dirname, "__fixtures__");
const categoryHtml = readFileSync(join(fixturesDir, "ikea-category.html"), "utf8");
const productHtml = readFileSync(join(fixturesDir, "ikea-product.html"), "utf8");

const productUrls = parseIkeaProductUrls(categoryHtml);
assert.deepEqual(productUrls, [
  "https://www.ikea.com/ae/en/p/glostad-3-seat-sofa-knisa-dark-grey-40573285/",
  "https://www.ikea.com/ae/en/p/kivik-3-seat-sofa-tresund-light-beige-s89482830/"
]);
assert.ok(!productUrls.some((url) => url.includes("search") || url.includes("cart") || url.includes("catalog")));
assert.ok(!productUrls.includes("https://www.ikea.com/ae/en/p/fragment-only-example-12345678/"));

const categoryProducts = parseIkeaCategoryProducts(categoryHtml);
assert.equal(categoryProducts[0]?.categoryHint, "Sofa & Couch Sets Online in UAE");
assert.equal(categoryProducts[1]?.salePriceText, "1695");
assert.equal(categoryProducts[1]?.listPriceText, "1995");

const parsed = parseIkeaProductHtml(
  productHtml,
  "https://www.ikea.com/ae/en/p/glostad-3-seat-sofa-knisa-dark-grey-40573285/",
  "Three-seat sofas",
  {
    sourceFreshnessTimestamp: "2026-05-25T15:00:00.000Z"
  }
);

assert.equal(parsed.canonicalUrl, "https://www.ikea.com/ae/en/p/glostad-3-seat-sofa-knisa-dark-grey-40573285/");
assert.equal(parsed.name, "GLOSTAD 3-seat sofa - Knisa dark grey");
assert.equal(parsed.externalSku, "405.732.85");
assert.equal(parsed.priceText, "495");
assert.equal(parsed.currency, "AED");
assert.equal(parsed.availability, "in stock");
assert.equal(parsed.retailerCategory, "Three-seat sofas");
assert.equal(parsed.color, "grey");
assert.equal(parsed.material, "Fabric");
assert.equal(parsed.dimensionsText, "width 171 cm x depth 78 cm");
assert.equal(
  parsed.primaryImageUrl,
  "https://www.ikea.com/ae/en/images/products/glostad-3-seat-sofa-knisa-dark-grey__1234948_pe917261_s5.jpg"
);
assert.equal(parsed.imageUrls?.length, 2);

const saleParsed = parseIkeaProductHtml(
  productHtml,
  "https://www.ikea.com/ae/en/p/glostad-3-seat-sofa-knisa-dark-grey-40573285/",
  "Three-seat sofas",
  {
    salePriceText: "395",
    listPriceText: "495"
  }
);

assert.equal(saleParsed.priceText, "495");
assert.equal(saleParsed.salePriceText, "395");

assert.ok(isCleanIkeaCategoryUrl("https://www.ikea.com/ae/en/cat/sofas-fu003/"));
assert.ok(isCleanIkeaProductUrl("https://www.ikea.com/ae/en/p/kivik-3-seat-sofa-tresund-light-beige-s89482830/"));
assert.ok(!isCleanIkeaCategoryUrl("https://www.ikea.com/ae/en/cat/sofas-fu003/?page=2"));
assert.ok(!isCleanIkeaProductUrl("https://www.ikea.com/ae/en/p/glostad-3-seat-sofa-knisa-dark-grey-40573285/#product"));
assert.ok(!isCleanIkeaProductUrl("https://www.ikea.com/ae/en/search/?q=sofa"));
assert.ok(!isCleanIkeaProductUrl("https://www.ikea.com/ae/en/cart/"));
assert.ok(!isCleanIkeaProductUrl("https://www.ikea.com/ae/en/catalog/productAlternative/"));
assert.ok(!isCleanIkeaProductUrl("https://www.ikea.com/us/en/p/glostad-3-seat-sofa-knisa-dark-grey-40573285/"));

console.log("ikea adapter tests passed");
