import assert from "node:assert/strict";

import { parseChattelsProductHtml, parseChattelsProductUrls } from "./chattels";

const categoryHtml = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "ItemList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "item": {
        "@type": "Product",
        "name": "Rio Sofa",
        "url": "https://www.chattelsandmore.com/en/rio-3seater-sofa-with-wide-armrest-beige"
      }
    },
    {
      "@type": "ListItem",
      "item": {
        "@type": "Product",
        "name": "External",
        "url": "https://example.com/en/not-a-retailer-product"
      }
    }
  ]
}
</script>
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "mainEntity": {
    "@type": "ItemList",
    "itemListElement": [
      {
        "@type": "ListItem",
        "item": {
          "@type": "Product",
          "name": "Gigi Corner Sofa",
          "url": "https://www.chattelsandmore.com/en/corner-sofa-gigi-right"
        }
      }
    ]
  }
}
</script>
`;

const urls = parseChattelsProductUrls(categoryHtml);
assert.deepEqual(urls, [
  "https://www.chattelsandmore.com/en/rio-3seater-sofa-with-wide-armrest-beige",
  "https://www.chattelsandmore.com/en/corner-sofa-gigi-right"
]);

const productHtml = `
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "Thanos 5-Seater Sofa - Off White | Polyester Fabric & Pine Wood Frame",
  "image": [
    "https://www.chattelsandmore.com/media/catalog/product/thanos-1.jpg",
    "https://www.chattelsandmore.com/media/catalog/product/thanos-2.jpg"
  ],
  "description": "<p>Large sofa for living spaces.</p>",
  "sku": "FCM01TOPL0096",
  "mpn": "FCM01TOPL0096",
  "brand": "Chattels & More",
  "color": "Off White",
  "material": "Polyester Fabric and Pine Wood Frame",
  "category": "Living > Sofas > 5 Seater Sofas",
  "width": {"@type": "QuantitativeValue", "value": 320, "unitCode": "CMT"},
  "depth": {"@type": "QuantitativeValue", "value": 102, "unitCode": "CMT"},
  "height": {"@type": "QuantitativeValue", "value": 76, "unitCode": "CMT"},
  "offers": {
    "@type": "Offer",
    "url": "https://www.chattelsandmore.com/en/thanos-5-seater-sofa-with-arm-sand",
    "priceCurrency": "AED",
    "price": 8750,
    "availability": "https://schema.org/InStock"
  }
}
</script>
`;

const parsed = parseChattelsProductHtml(
  productHtml,
  "https://www.chattelsandmore.com/en/thanos-5-seater-sofa-with-arm-sand"
);

assert.equal(parsed.name, "Thanos 5-Seater Sofa - Off White | Polyester Fabric & Pine Wood Frame");
assert.equal(parsed.externalSku, "FCM01TOPL0096");
assert.equal(parsed.priceText, "8750");
assert.equal(parsed.currency, "AED");
assert.equal(parsed.availability, "in stock");
assert.equal(parsed.color, "Off White");
assert.equal(parsed.material, "Polyester Fabric and Pine Wood Frame");
assert.equal(parsed.retailerCategory, "Living > Sofas > 5 Seater Sofas");
assert.equal(parsed.primaryImageUrl, "https://www.chattelsandmore.com/media/catalog/product/thanos-1.jpg");
assert.equal(parsed.imageUrls?.length, 2);
assert.equal(parsed.dimensionsText, "W 320 CMT x D 102 CMT x H 76 CMT");

console.log("chattels adapter tests passed");
