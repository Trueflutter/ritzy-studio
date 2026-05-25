import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  isCleanPanHomeProductUrl,
  parsePanHomeChildSitemaps,
  parsePanHomeProductHtml,
  parsePanHomeSitemapEntries
} from "./panhome";

const fixturesDir = join(dirname(fileURLToPath(import.meta.url)), "__fixtures__");
const rootSitemapXml = readFileSync(join(fixturesDir, "panhome-root-sitemap.xml"), "utf8");
const childSitemapXml = readFileSync(join(fixturesDir, "panhome-child-sitemap.xml"), "utf8");
const productHtml = readFileSync(join(fixturesDir, "panhome-product.html"), "utf8");

assert.deepEqual(parsePanHomeChildSitemaps(rootSitemapXml), [
  "https://www.panhomestores.com/pub/media/uae_en_sitemap_001.xml",
  "https://www.panhomestores.com/pub/media/uae_en_sitemap_002.xml"
]);

const entries = parsePanHomeSitemapEntries(childSitemapXml);
assert.equal(entries.length, 4);
assert.equal(entries[0]?.url, "https://www.panhomestores.com/uae_en/creed-coffee-table-marble-white-black-041jsl0800111");
assert.equal(entries[0]?.lastmod, "2026-05-24");
assert.deepEqual(entries[0]?.imageUrls, [
  "https://cdn.panhomestores.com/media/catalog/product/0/4/041JSL0800111_4.jpg"
]);
assert.deepEqual(entries[0]?.imageTitles, ["CREED COFFEE TABLE MARBLE - WHITE & BLACK"]);

assert.equal(
  isCleanPanHomeProductUrl("https://www.panhomestores.com/uae_en/creed-coffee-table-marble-white-black-041jsl0800111"),
  true
);
assert.equal(isCleanPanHomeProductUrl("https://www.panhomestores.com/uae_en/about-us"), false);
assert.equal(isCleanPanHomeProductUrl("https://www.panhomestores.com/uae_en/search?q=sofa"), false);

const parsed = parsePanHomeProductHtml(
  productHtml,
  "https://www.panhomestores.com/uae_en/creed-coffee-table-marble-white-black-041jsl0800111",
  "living room",
  {
    lastmod: "2026-05-24",
    imageUrls: ["https://cdn.panhomestores.com/media/catalog/product/0/4/041JSL0800111_4.jpg"],
    imageTitles: ["CREED COFFEE TABLE MARBLE - WHITE & BLACK"]
  }
);

assert.equal(parsed.name, "CREED COFFEE TABLE MARBLE - WHITE & BLACK");
assert.equal(parsed.canonicalUrl, "https://www.panhomestores.com/uae_en/creed-coffee-table-marble-white-black-041jsl0800111");
assert.equal(parsed.externalSku, "041JSL0800111");
assert.equal(parsed.priceText, "1499");
assert.equal(parsed.salePriceText, "999");
assert.equal(parsed.currency, "AED");
assert.equal(parsed.availability, "in stock");
assert.equal(
  parsed.primaryImageUrl,
  "https://cdn.panhomestores.com/cdn-cgi/image/quality=70,height=,width=/media/catalog/product/0/4/041JSL0800111_4.jpg"
);
assert.deepEqual(parsed.imageUrls, [
  "https://cdn.panhomestores.com/cdn-cgi/image/quality=70,height=,width=/media/catalog/product/0/4/041JSL0800111_4.jpg",
  "https://cdn.panhomestores.com/media/catalog/product/0/4/041JSL0800111_4.jpg",
  "https://cdn.panhomestores.com/media/catalog/product/0/4/041JSL0800111_5.jpg"
]);
assert.equal(parsed.retailerCategory, "living room");
assert.equal(parsed.dimensionsText, "120 x 60 x 42 cm");
assert.equal(parsed.color, "White & Black");
assert.equal(parsed.material, "Marble");
assert.deepEqual(parsed.sourcePayload, {
  source: "panhome",
  sourceFreshnessTimestamp: "2026-05-24",
  sitemapImageCount: 1,
  stockQuantity: 38,
  robotsNotes:
    "robots.txt lists the UAE sitemap and disallows checkout, customer/my-account, search, catalog view, SID, and parameterized filter/sort/price URLs. Adapter uses clean /uae_en/ product URLs from sitemap only.",
  attributes: {
    fabric: null,
    finish: "Metal frame"
  }
});

const parsedWithSlugDimensions = parsePanHomeProductHtml(
  "<script>window.actionName = { sku: `123GGO9900555` || null, name: `HILTON MARBEL DOWN ALTERNATIVE FILLED CUSHION 40X60CM - ANTHRACITE`, page: {\"isInStock\":0,\"availableQty\":[]} || {}, imageUrl: `` || null, mediaGallery: `[]` };</script>",
  "https://www.panhomestores.com/uae_en/hilton-marbel-down-alternative-filled-cushion-40x60cm-anthracite-123ggo9900555"
);
assert.equal(parsedWithSlugDimensions.retailerCategory, "soft furnishing");
assert.equal(parsedWithSlugDimensions.availability, "out of stock");
assert.equal(parsedWithSlugDimensions.dimensionsText, "40 x 60 cm");
assert.equal(parsedWithSlugDimensions.color, "Anthracite");

console.log("panhome adapter tests passed");
