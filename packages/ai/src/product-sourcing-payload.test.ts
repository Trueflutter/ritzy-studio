import assert from "node:assert/strict";

import { productSourcingProvidedImageContent, type ConceptProductSourcingCandidate } from "./index";

const candidate = (id: string, primaryImageUrl: string | null): ConceptProductSourcingCandidate => ({
  id,
  name: `Product ${id}`,
  retailerName: "Retailer",
  category: "sofas",
  primaryImageUrl
});

// S3: only app-provided data URLs reach the provider, in candidate order, at
// the requested detail; a raw retailer URL is never sent.
assert.deepEqual(
  productSourcingProvidedImageContent(
    [
      candidate("one", "https://retailer.example/one.jpg"),
      candidate("two", "https://retailer.example/two.jpg"),
      candidate("three", null)
    ],
    { two: "data:image/jpeg;base64,AAA", three: "data:image/jpeg;base64,BBB" },
    "low"
  ),
  [
    { type: "input_text", text: "Candidate product image for id two: Product two" },
    { type: "input_image", image_url: "data:image/jpeg;base64,AAA", detail: "low" },
    { type: "input_text", text: "Candidate product image for id three: Product three" },
    { type: "input_image", image_url: "data:image/jpeg;base64,BBB", detail: "low" }
  ]
);
assert.deepEqual(productSourcingProvidedImageContent([candidate("one", "https://retailer.example/one.jpg")], {}), []);
assert.equal(
  productSourcingProvidedImageContent([candidate("one", null)], { one: "data:image/png;base64,CCC" })[1]?.detail,
  "low",
  "detail defaults to low"
);

console.log("product-sourcing-payload tests passed");
