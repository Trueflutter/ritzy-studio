import assert from "node:assert/strict";

import {
  productSourcingCandidateImageContent,
  productSourcingProvidedImageContent,
  type ConceptProductSourcingCandidate
} from "./index";

const candidate = (id: string, primaryImageUrl: string | null): ConceptProductSourcingCandidate => ({
  id,
  name: `Product ${id}`,
  retailerName: "Retailer",
  category: "sofas",
  primaryImageUrl
});

const content = productSourcingCandidateImageContent(
  [
    candidate("one", "https://retailer.example/one.jpg"),
    candidate("two", null),
    candidate("three", "https://retailer.example/three.jpg"),
    candidate("four", "https://retailer.example/four.jpg")
  ],
  {
    candidateLimit: 4,
    candidateImageLimit: 2,
    detail: "low"
  }
);

assert.equal(content.length, 4);
assert.deepEqual(content, [
  {
    type: "input_text",
    text: "Candidate product image for id one: Product one"
  },
  {
    type: "input_image",
    image_url: "https://retailer.example/one.jpg",
    detail: "low"
  },
  {
    type: "input_text",
    text: "Candidate product image for id three: Product three"
  },
  {
    type: "input_image",
    image_url: "https://retailer.example/three.jpg",
    detail: "low"
  }
]);

assert.deepEqual(
  productSourcingCandidateImageContent([candidate("one", "https://retailer.example/one.jpg")], {
    candidateImageLimit: 0
  }),
  []
);

assert.deepEqual(
  productSourcingCandidateImageContent(
    [
      candidate("one", "https://retailer.example/one.jpg"),
      candidate("two", "https://retailer.example/two.jpg")
    ],
    {
      candidateLimit: 2,
      candidateImageLimit: 0
    }
  ),
  []
);

// S3 spec path: only app-provided data URLs reach the provider, in candidate
// order, at the requested detail; a raw retailer URL is never sent.
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

console.log("product-sourcing-payload provided-image tests passed");
