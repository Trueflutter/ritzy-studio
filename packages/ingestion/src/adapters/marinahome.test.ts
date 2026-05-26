import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import {
  isCleanMarinaHomeCategoryUrl,
  isCleanMarinaHomeProductUrl,
  parseMarinaHomeProductHtml,
  parseMarinaHomeSitemapDiscoveries,
  parseMarinaHomeSitemapEntries
} from "./marinahome";

const fixturesDir = join(import.meta.dirname, "__fixtures__");
const sitemapXml = readFileSync(join(fixturesDir, "marinahome-sitemap.xml"), "utf8");
const productShellHtml = readFileSync(join(fixturesDir, "marinahome-product-shell.html"), "utf8");
const categoryShellHtml = readFileSync(join(fixturesDir, "marinahome-category-shell.html"), "utf8");

const entries = parseMarinaHomeSitemapEntries(sitemapXml);
assert.equal(entries.length, 6);
assert.equal(entries[1]?.url, "https://www.marinahomeinteriors.com/en-uae/nanina-right-chaise-sectional-sofa-grey-fabric-bea2263.html");
assert.equal(entries[1]?.lastmod, "2026-03-06T10:41:23+00:00");
assert.deepEqual(entries[1]?.imageUrls, [
  "https://prodmarinamedia.gumlet.io/media/catalog/product/cache/sample/B/E/BEA2263-1.jpeg",
  "https://prodmarinamedia.gumlet.io/media/catalog/product/cache/sample/B/E/BEA2263-2.jpeg"
]);
assert.deepEqual(entries[1]?.imageTitles, [
  "NANINA RIGHT CHAISE SECTIONAL SOFA",
  "NANINA RIGHT CHAISE SECTIONAL SOFA"
]);

const defaultDiscoveries = parseMarinaHomeSitemapDiscoveries(sitemapXml, { limit: 10 });
assert.deepEqual(defaultDiscoveries.map((discovery) => discovery.url), [
  "https://www.marinahomeinteriors.com/en-uae/nanina-right-chaise-sectional-sofa-grey-fabric-bea2263.html",
  "https://www.marinahomeinteriors.com/en-uae/sunburst-dining-table-brown-wood-bjk1015.html"
]);
assert.ok(!defaultDiscoveries.some((discovery) => discovery.url.includes("coffee-table")));
assert.ok(!defaultDiscoveries.some((discovery) => discovery.url.includes("/catalog/")));

const customCategoryDiscoveries = parseMarinaHomeSitemapDiscoveries(sitemapXml, {
  limit: 10,
  categories: [
    "https://www.marinahomeinteriors.com/en-uae/table/dining-tables.html",
    "https://www.marinahomeinteriors.com/en-uae/table/coffee-tables.html"
  ]
});
assert.deepEqual(customCategoryDiscoveries.map((discovery) => discovery.url), [
  "https://www.marinahomeinteriors.com/en-uae/sunburst-dining-table-brown-wood-bjk1015.html"
]);

assert.ok(isCleanMarinaHomeCategoryUrl("https://www.marinahomeinteriors.com/en-uae/seating/sofas.html"));
assert.ok(isCleanMarinaHomeCategoryUrl("https://www.marinahomeinteriors.com/en-uae/table/dining-tables.html"));
assert.ok(isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/nanina-right-chaise-sectional-sofa-grey-fabric-bea2263.html"));
assert.ok(isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/sunburst-dining-table-brown-wood-bjk1015.html"));
assert.ok(!isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/nanina-right-chaise-sectional-sofa-grey-fabric-bea2263.html?filter=color"));
assert.ok(!isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/nanina-right-chaise-sectional-sofa-grey-fabric-bea2263.html#product"));
assert.ok(!isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/catalog/category/view/id/43/"));
assert.ok(!isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/catalog/product/view/id/123/"));
assert.ok(!isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/catalogsearch/result/?q=sofa"));
assert.ok(!isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/customer/account/"));
assert.ok(!isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/checkout/"));
assert.ok(!isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/review/product/list/id/123/"));
assert.ok(!isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/en-uae/tag/product/list/tagId/1/"));
assert.ok(!isCleanMarinaHomeProductUrl("https://www.marinahomeinteriors.com/ar-uae/nanina-right-chaise-sectional-sofa-grey-fabric-bea2263.html"));
assert.ok(!isCleanMarinaHomeProductUrl("https://example.com/en-uae/nanina-right-chaise-sectional-sofa-grey-fabric-bea2263.html"));
assert.ok(!isCleanMarinaHomeCategoryUrl("https://www.marinahomeinteriors.com/en-uae/seating/sofas.html?filter=color"));

const parsed = parseMarinaHomeProductHtml(
  productShellHtml,
  "https://www.marinahomeinteriors.com/en-uae/nanina-right-chaise-sectional-sofa-grey-fabric-bea2263.html",
  "seating",
  {
    lastmod: entries[1]?.lastmod,
    imageUrls: entries[1]?.imageUrls,
    imageTitles: entries[1]?.imageTitles,
    imageCaptions: entries[1]?.imageCaptions,
    sitemapCategoryUrl: "https://www.marinahomeinteriors.com/en-uae/seating/sofas.html"
  }
);

assert.equal(parsed.canonicalUrl, "https://www.marinahomeinteriors.com/en-uae/nanina-right-chaise-sectional-sofa-grey-fabric-bea2263.html");
assert.equal(parsed.name, "NANINA RIGHT CHAISE SECTIONAL SOFA");
assert.equal(parsed.externalSku, "BEA2263");
assert.equal(parsed.retailerCategory, "seating");
assert.equal(parsed.priceText, null);
assert.equal(parsed.salePriceText, null);
assert.equal(parsed.availability, null);
assert.equal(parsed.dimensionsText, null);
assert.equal(parsed.color, "Grey");
assert.equal(parsed.material, "Fabric");
assert.equal(parsed.primaryImageUrl, "https://prodmarinamedia.gumlet.io/media/catalog/product/cache/sample/B/E/BEA2263-1.jpeg");
assert.equal(parsed.imageUrls?.length, 3);
assert.deepEqual((parsed.sourcePayload as { imageTitles: string[] }).imageTitles, [
  "NANINA RIGHT CHAISE SECTIONAL SOFA",
  "NANINA RIGHT CHAISE SECTIONAL SOFA"
]);
assert.equal(
  (parsed.sourcePayload as { sitemapCategoryUrl: string }).sitemapCategoryUrl,
  "https://www.marinahomeinteriors.com/en-uae/seating/sofas.html"
);

const fallbackParsed = parseMarinaHomeProductHtml(
  categoryShellHtml,
  "https://www.marinahomeinteriors.com/en-uae/sunburst-dining-table-brown-wood-bjk1015.html",
  undefined,
  {
    lastmod: entries[2]?.lastmod,
    imageUrls: entries[2]?.imageUrls,
    imageTitles: entries[2]?.imageTitles,
    sitemapCategoryUrl: "https://www.marinahomeinteriors.com/en-uae/table/dining-tables.html"
  }
);

assert.equal(fallbackParsed.name, "SUNBURST DINING TABLE");
assert.equal(fallbackParsed.externalSku, "BJK1015");
assert.equal(fallbackParsed.retailerCategory, "dining tables");
assert.equal(fallbackParsed.color, "Brown");
assert.equal(fallbackParsed.material, "Wood");
assert.equal(fallbackParsed.priceText, null);
assert.equal(fallbackParsed.salePriceText, null);
assert.equal(fallbackParsed.availability, null);
assert.equal(fallbackParsed.dimensionsText, null);

assert.throws(
  () =>
    parseMarinaHomeProductHtml(
      productShellHtml,
      "https://www.marinahomeinteriors.com/en-uae/catalog/product/view/id/123/",
      "bad",
      {}
    ),
  /not a clean product URL/
);

console.log("marinahome adapter tests passed");
