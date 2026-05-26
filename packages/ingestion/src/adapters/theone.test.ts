import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isAllowedTheOneFetchUrl,
  isCleanTheOneCategoryUrl,
  isCleanTheOneProductUrl,
  parseTheOneProductHtml,
  parseTheOneProductUrls,
  theOneAdapter
} from "./theone";

const fixturesDir = join(import.meta.dirname, "__fixtures__");
const categoryHtml = readFileSync(join(fixturesDir, "theone-category.html"), "utf8");
const productHtml = readFileSync(join(fixturesDir, "theone-product.html"), "utf8");
const missingFieldsHtml = readFileSync(join(fixturesDir, "theone-product-missing-fields.html"), "utf8");

assert.equal(theOneAdapter.key, "theone-ae");
assert.equal(theOneAdapter.dryRunOnly, true);

assert.deepEqual(parseTheOneProductUrls(categoryHtml), [
  "https://www.theone.com/product/casablanca-lantern-nickel-h64cm-449686",
  "https://www.theone.com/product/miyu-table-lamp-cream-h79cm-585717"
]);

assert.equal(isAllowedTheOneFetchUrl("https://www.theone.com/robots.txt"), true);
assert.equal(isAllowedTheOneFetchUrl("https://www.theone.com/sitemap.xml"), true);
assert.equal(isAllowedTheOneFetchUrl("https://www.theone.com/category/lighting-table-lamps"), true);
assert.equal(isAllowedTheOneFetchUrl("https://www.theone.com/product/casablanca-lantern-nickel-h64cm-449686"), true);
assert.equal(isAllowedTheOneFetchUrl("https://www.theone.com/search?q=sofa"), false);
assert.equal(isAllowedTheOneFetchUrl("https://www.theone.com/producttag/ramadan"), false);
assert.equal(isCleanTheOneCategoryUrl("https://www.theone.com/category/living-sofas-all-sofas"), true);
assert.equal(isCleanTheOneCategoryUrl("https://www.theone.com/category/dining?sort=price"), false);
assert.equal(isCleanTheOneProductUrl("https://www.theone.com/product/casablanca-lantern-nickel-h64cm-449686"), true);
assert.equal(isCleanTheOneProductUrl("https://www.theone.com/product/casablanca-lantern-nickel-h64cm-449686?variant=nickel"), false);
assert.equal(isCleanTheOneProductUrl("https://www.theone.com/cart.html"), false);
assert.equal(isCleanTheOneProductUrl("https://www.theone.com/checkout.html"), false);
assert.equal(isCleanTheOneProductUrl("https://www.theone.com/account-dashboard.html"), false);
assert.equal(isCleanTheOneProductUrl("https://www.theone.com/producttag/ramadan"), false);
assert.equal(isCleanTheOneProductUrl("https://www.theone.com/catalog/product/view/id/449686"), false);
assert.equal(isCleanTheOneProductUrl("https://example.com/product/casablanca-lantern-nickel-h64cm-449686"), false);

const parsed = parseTheOneProductHtml(
  productHtml,
  "https://www.theone.com/product/casablanca-lantern-nickel-h64cm-449686",
  "lighting",
  {
    seedCategoryUrl: "https://www.theone.com/category/lighting-table-lamps",
    sourceFreshnessTimestamp: "2026-05-26T03:45:00.000Z"
  }
);

assert.equal(parsed.canonicalUrl, "https://www.theone.com/product/casablanca-lantern-nickel-h64cm-449686");
assert.equal(parsed.name, "Casablanca Lantern Nickel H64cm");
assert.equal(parsed.externalSku, "449686");
assert.equal(parsed.priceText, "319");
assert.equal(parsed.salePriceText, null);
assert.equal(parsed.currency, "AED");
assert.equal(parsed.availability, "in stock");
assert.equal(parsed.retailerCategory, "lighting");
assert.equal(parsed.primaryImageUrl, "https://www.theone.com/media/catalog/product/c/a/casablanca-lantern-nickel-h64cm-449686-1.jpg");
assert.equal(parsed.imageUrls?.length, 3);
assert.equal(parsed.color, "Nickel");
assert.equal(parsed.material, "Nickel");
assert.equal(parsed.dimensionsText, "H 64 cm");
assert.deepEqual((parsed.sourcePayload as { breadcrumbs: string[] }).breadcrumbs, ["Home", "Lighting", "Table Lamps"]);
assert.equal(
  (parsed.sourcePayload as { seedCategoryUrl: string }).seedCategoryUrl,
  "https://www.theone.com/category/lighting-table-lamps"
);

const parsedMissingFields = parseTheOneProductHtml(
  missingFieldsHtml,
  "https://www.theone.com/product/oren-rug-white-grey-200x300cm-647001"
);
assert.equal(parsedMissingFields.name, "Oren Rug White Grey 200x300cm");
assert.equal(parsedMissingFields.externalSku, "647001");
assert.equal(parsedMissingFields.priceText, null);
assert.equal(parsedMissingFields.availability, null);
assert.equal(parsedMissingFields.retailerCategory, "rugs/floor covering");
assert.equal(parsedMissingFields.dimensionsText, "200 x 300 cm");

await assert.rejects(
  () =>
    theOneAdapter.extractProduct({
      url: "https://www.theone.com/search?q=sofa",
      source: "manual_seed"
    }),
  /not a clean product URL/
);

console.log("theone adapter tests passed");
