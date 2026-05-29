import assert from "node:assert/strict";

import { productSourcingVisualStrategy } from "./product-sourcing-visual-strategy";

const fastFallback = productSourcingVisualStrategy({
  productCandidateImagesEnabled: false,
  candidateImageLimit: 0,
  rolePoolCount: 10
});

assert.equal(fastFallback.shouldAttemptVisualSourcing, false);
assert.equal(fastFallback.fallbackReason, "product_candidate_images_disabled");
assert.ok(fastFallback.evidenceNote?.includes("without waiting"));

const noRolePools = productSourcingVisualStrategy({
  productCandidateImagesEnabled: false,
  candidateImageLimit: 0,
  rolePoolCount: 0
});

assert.equal(noRolePools.shouldAttemptVisualSourcing, true);
assert.equal(noRolePools.fallbackReason, null);

const imagesEnabled = productSourcingVisualStrategy({
  productCandidateImagesEnabled: true,
  candidateImageLimit: 2,
  rolePoolCount: 10
});

assert.equal(imagesEnabled.shouldAttemptVisualSourcing, true);
assert.equal(imagesEnabled.fallbackReason, null);
