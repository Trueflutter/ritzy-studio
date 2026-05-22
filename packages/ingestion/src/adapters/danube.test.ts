import assert from "node:assert/strict";

import { parseDanubeProductHtml, parseDanubeProductUrls } from "./danube";

const productHtml = `
<html><head>
<meta name="description" content="Shop Form 3-Seater Fabric Sofa"/>
<meta property="twitter:image" content="https://assets.danubehome.com/media/dh-seller/p/810401102393/810401102393-1.jpg"/>
<meta property="twitter:url" content="https://www.danubehome.com/ae/en/p/form-three-seater-fabric-sofa-beige-810401102393"/>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","description":"Form 3-Seater Fabric Sofa","category":"3 Seater Sofa","color":"Beige","image":["https://assets.danubehome.com/media/dh-seller/p/810401102393/810401102393-1.jpg","https://assets.danubehome.com/media/dh-seller/p/810401102393/810401102393-2.jpg"],"offers":{"price":1649,"priceCurrency":"AED","availability":"https://schema.org/InStock","@type":"Offer"},"name":"Form 3-Seater Fabric Sofa"}</script>
</head><body>
<div><label>Colour</label><div class="ProductInfo_informationDetailsList__tzm4E">Beige</div></div>
<div><label>Material</label><div class="ProductInfo_informationDetailsList__tzm4E">Solid Wood</div></div>
<div><label>Upholstery</label><div class="ProductInfo_informationDetailsList__tzm4E">Fabric</div></div>
<div><label>Length (cm)</label><div class="ProductInfo_informationDetailsList__tzm4E">212</div></div>
<div><label>Width (cm)</label><div class="ProductInfo_informationDetailsList__tzm4E">95</div></div>
<div><label>Height (cm)</label><div class="ProductInfo_informationDetailsList__tzm4E">80</div></div>
</body></html>
`;

const parsed = parseDanubeProductHtml(
  productHtml,
  "https://www.danubehome.com/ae/en/p/form-three-seater-fabric-sofa-beige-810401102393"
);

assert.equal(parsed.name, "Form 3-Seater Fabric Sofa");
assert.equal(parsed.retailerCategory, "3 Seater Sofa");
assert.equal(parsed.externalSku, "810401102393");
assert.equal(parsed.priceText, "1649");
assert.equal(parsed.currency, "AED");
assert.equal(parsed.availability, "in stock");
assert.equal(parsed.color, "Beige");
assert.equal(parsed.material, "Fabric");
assert.equal(parsed.dimensionsText, "W 212 x D 95 x H 80 cm");
assert.equal(parsed.imageUrls?.length, 2);

const categoryHtml = `
<a href="/ae/en/p/danube-home-gift-card-990200100097">Gift Card</a>
<a href="/ae/en/p/alonzo-fabric-sofabed-light-grey-810401102243">Alonzo</a>
<a href="/ae/en/p/alonzo-fabric-sofabed-light-grey-810401102243">Alonzo duplicate</a>
<a href="/ae/en/p/not-a-product">Not a product</a>
`;

const urls = parseDanubeProductUrls(categoryHtml);
assert.deepEqual(urls, [
  "https://www.danubehome.com/ae/en/p/alonzo-fabric-sofabed-light-grey-810401102243"
]);

console.log("danube adapter tests passed");
