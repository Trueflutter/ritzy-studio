import assert from "node:assert/strict";

import { parseHomeCentreProductHtml, parseProductUrlsFromCategoryHtml } from "./homecentre";

const productHtml = `
<html><head>
<meta property="product:title" content="Narissa 3-Seater Fabric Sofa"/>
<meta property="product:price:amount" content="3299"/>
<meta property="product:price:currency" content="AED"/>
<meta property="product:availability" content="in stock"/>
<meta property="product:product_type" content="Furniture &gt; Sofa &amp; Seating &gt; Sofas &amp; Sofa Sets"/>
<meta property="product:additional_image_link" content="https://media.homecentre.com/i/homecentre/1.jpg,https://media.homecentre.com/i/homecentre/2.jpg"/>
<script type="application/ld+json">{"@context":"https://schema.org/","@type":"Product","name":"Narissa 3-Seater Fabric Sofa","image":"https://media.homecentre.com/i/homecentre/1.jpg","color":"Ivory","description":"Buy Narissa 3-Seater Fabric Sofa","offers":{"@type":"Offer","url":"https://www.homecentre.com/ae/en/buy-narissa-3-seater-fabric-sofa/p/168425236","priceCurrency":"AED","price":3299,"availability":"https://schema.org/InStock"}}</script>
</head></html>
`;

const parsed = parseHomeCentreProductHtml(
  productHtml,
  "https://www.homecentre.com/ae/en/buy-narissa-3-seater-fabric-sofa/p/168425236"
);

assert.equal(parsed.name, "Narissa 3-Seater Fabric Sofa");
assert.equal(parsed.priceText, "3299");
assert.equal(parsed.currency, "AED");
assert.equal(parsed.availability, "in stock");
assert.equal(parsed.color, "Ivory");
assert.equal(parsed.imageUrls?.length, 3);

const categoryHtml = `
<a href="/ae/en/buy-narissa-3seater-fabric-sofa/p/168425236">Narissa</a>
<script type="application/ld+json">{"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"@type":"ListItem","item":{"@type":"Product","name":"Flow","url":"https://www.homecentre.com/ae/en/buy-flow-6seater-fabric-sofa/p/168243354"}}]}</script>
`;

const urls = parseProductUrlsFromCategoryHtml(categoryHtml);
assert.equal(urls.length, 2);
assert.ok(urls.includes("https://www.homecentre.com/ae/en/buy-flow-6seater-fabric-sofa/p/168243354"));
assert.ok(urls.includes("https://www.homecentre.com/ae/en/buy-narissa-3seater-fabric-sofa/p/168425236"));

console.log("homecentre adapter tests passed");
