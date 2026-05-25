import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  homesRusAdapter,
  isCleanHomesRusCategoryUrl,
  isCleanHomesRusProductUrl,
  parseHomesRusProductHtml,
  parseHomesRusProductUrls
} from "./homesrus";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const categoryHtml = readFileSync(join(fixturesDir, "homesrus-category.html"), "utf8");
const productHtml = readFileSync(join(fixturesDir, "homesrus-product.html"), "utf8");
const missingFieldsHtml = readFileSync(join(fixturesDir, "homesrus-product-missing-fields.html"), "utf8");

assert.deepEqual(parseHomesRusProductUrls(categoryHtml), [
  "https://www.homesrus.ae/en/5121100313298-simon-3-seater-sofa-beige/",
  "https://www.homesrus.ae/en/5121100313281-simon-4-seater-sofa-beige/"
]);

assert.equal(isCleanHomesRusProductUrl("https://www.homesrus.ae/en/5121100313298-simon-3-seater-sofa-beige/"), true);
assert.equal(isCleanHomesRusProductUrl("https://www.homesrus.ae/en/5121100313298-simon-3-seater-sofa-beige/?color=beige"), false);
assert.equal(isCleanHomesRusProductUrl("https://www.homesrus.ae/en/5121100313298-simon-3-seater-sofa-beige/#details"), false);
assert.equal(isCleanHomesRusProductUrl("https://www.homesrus.ae/en/catalog/product/view/id/1029948/"), false);
assert.equal(isCleanHomesRusProductUrl("https://www.homesrus.ae/en/catalogsearch/result/?q=sofa"), false);
assert.equal(isCleanHomesRusProductUrl("https://www.homesrus.ae/en/rest/V1/products/5121100313298/"), false);
assert.equal(isCleanHomesRusProductUrl("https://www.example.com/en/5121100313298-simon-3-seater-sofa-beige/"), false);
assert.equal(isCleanHomesRusCategoryUrl("https://www.homesrus.ae/en/furniture/sofas-chairs/sofa/"), true);
assert.equal(isCleanHomesRusCategoryUrl("https://www.homesrus.ae/en/furniture/sofas-chairs/sofa/?price=1,999"), false);

const parsed = parseHomesRusProductHtml(
  productHtml,
  "https://www.homesrus.ae/en/5121100313298-simon-3-seater-sofa-beige/",
  "living room",
  {
    seedCategoryUrl: "https://www.homesrus.ae/en/furniture/sofas-chairs/sofa/",
    sourceFreshnessTimestamp: "2026-05-25T13:40:00.000Z"
  }
);

assert.equal(parsed.name, "Simon 3-Seater Sofa, Beige");
assert.equal(parsed.canonicalUrl, "https://www.homesrus.ae/en/5121100313298-simon-3-seater-sofa-beige/");
assert.equal(parsed.externalSku, "5121100313298");
assert.equal(parsed.priceText, "8499.000000");
assert.equal(parsed.salePriceText, "5949");
assert.equal(parsed.currency, "AED");
assert.equal(parsed.availability, "in stock");
assert.equal(parsed.retailerCategory, "living room");
assert.equal(parsed.primaryImageUrl, "https://www.homesrus.ae/media/catalog/product/5/1/5121100313298_0.jpg");
assert.deepEqual(parsed.imageUrls, ["https://www.homesrus.ae/media/catalog/product/5/1/5121100313298_0.jpg"]);
assert.equal(parsed.color, "Beige");
assert.equal(parsed.material, "Fabric");
assert.equal(parsed.dimensionsText, "235cm x 100cm, Seat Depth 65x180cm x 70cm, Ground Clearance 10cm");
assert.deepEqual(parsed.sourcePayload, {
  source: "homesrus",
  sourceFreshnessTimestamp: "2026-05-25T13:40:00.000Z",
  seedCategoryUrl: "https://www.homesrus.ae/en/furniture/sofas-chairs/sofa/",
  robotsNotes:
    "robots.txt is available at /robots.txt with browser-style headers; it declares Crawl-delay: 10, disallows all query/parameter URLs via *?*=*, and disallows /catalog/ plus checkout, customer, search, sendfriend, review, vendor, and SID paths. Adapter uses only clean /en/ category and product URLs.",
  attributes: {
    color: null,
    material: "Fabric",
    fabric: null,
    dimensionsText: "235cm x 100cm, Seat Depth 65x180cm x 70cm, Ground Clearance 10cm"
  }
});

const parsedMissingFields = parseHomesRusProductHtml(
  missingFieldsHtml,
  "https://www.homesrus.ae/en/5110400200841-buch-vase-white-15x30cm/"
);
assert.equal(parsedMissingFields.name, "Buch Vase, White");
assert.equal(parsedMissingFields.priceText, null);
assert.equal(parsedMissingFields.salePriceText, null);
assert.equal(parsedMissingFields.availability, null);
assert.equal(parsedMissingFields.material, null);
assert.equal(parsedMissingFields.dimensionsText, "15 x 30 cm");
assert.equal(parsedMissingFields.color, "White");

const parsedWithBadCanonical = parseHomesRusProductHtml(
  productHtml.replace(
    "https://www.homesrus.ae/en/5121100313298-simon-3-seater-sofa-beige/?___store=ae_en",
    "https://www.homesrus.ae/en/catalog/product/view/id/1029948/"
  ),
  "https://www.homesrus.ae/en/5121100313298-simon-3-seater-sofa-beige/"
);
assert.equal(
  parsedWithBadCanonical.canonicalUrl,
  "https://www.homesrus.ae/en/5121100313298-simon-3-seater-sofa-beige/"
);

await assert.rejects(
  () =>
    homesRusAdapter.extractProduct({
      url: "https://www.homesrus.ae/en/catalog/product/view/id/1029948/",
      source: "manual_seed"
    }),
  /not a clean product URL/
);

console.log("homesrus adapter tests passed");
