import assert from "node:assert/strict";

import { parseTwoXlProductHtml, parseTwoXlProductUrls } from "./twoxl";

const categoryHtml = `
<a href="https://2xlhome.com/ae-en/adley-4-seater-316x97x68-128303">Adley</a>
<a href="https://2xlhome.com/ae-en/furniture/sofa-seating/sofas">Sofas</a>
<script>window.productUrl = "https://2xlhome.com/ae-en/bliss-3-seater-128316";</script>
`;

const urls = parseTwoXlProductUrls(categoryHtml);
assert.deepEqual(urls, [
  "https://2xlhome.com/ae-en/adley-4-seater-316x97x68-128303",
  "https://2xlhome.com/ae-en/bliss-3-seater-128316"
]);

const productHtml = `
<html>
  <head>
    <meta property="og:title" content="Adley 4 Seater Sofa"/>
    <meta property="og:image" content="https://2xlhome.com/media/catalog/product/a/d/adley.jpg"/>
    <meta name="description" content="Adley sofa in boucle fabric"/>
  </head>
  <body>
    <script>
      window.productData = {
        "final_price":4699,
        "regular_price":6295,
        "url":"https:\\/\\/2xlhome.com\\/media\\/catalog\\/product\\/a\\/d\\/adley-alt.jpg",
        "productSku": "128303",
        "is_salable":"1"
      };
    </script>
  </body>
</html>
`;

const parsed = parseTwoXlProductHtml(
  productHtml,
  "https://2xlhome.com/ae-en/adley-4-seater-316x97x68-128303",
  "https://2xlhome.com/ae-en/furniture/sofa-seating/sofas"
);

assert.equal(parsed.name, "Adley 4 Seater Sofa");
assert.equal(parsed.externalSku, "128303");
assert.equal(parsed.priceText, "6295");
assert.equal(parsed.salePriceText, "4699");
assert.equal(parsed.currency, "AED");
assert.equal(parsed.availability, "in stock");
assert.equal(parsed.primaryImageUrl, "https://2xlhome.com/media/catalog/product/a/d/adley.jpg");
assert.equal(parsed.retailerCategory, "https://2xlhome.com/ae-en/furniture/sofa-seating/sofas");
assert.equal(parsed.dimensionsText, "316 x 97 x 68 cm");

const parsedWithoutDimensions = parseTwoXlProductHtml(
  productHtml,
  "https://2xlhome.com/ae-en/norwalk-5-seater-129420"
);
assert.equal(parsedWithoutDimensions.dimensionsText, null);

console.log("2xl adapter tests passed");
