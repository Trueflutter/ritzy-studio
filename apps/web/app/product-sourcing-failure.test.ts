import assert from "node:assert/strict";

import {
  classifyProductSourcingFailure,
  isProductSourcingTimeoutError,
  productSourcingGenericFailureMessage,
  productSourcingTimeoutMessage
} from "./product-sourcing-failure";

assert.equal(
  classifyProductSourcingFailure(new Error("Product visual sourcing timed out.")),
  "timeout"
);
assert.equal(isProductSourcingTimeoutError(new Error("Product visual sourcing retry timed out.")), true);
assert.equal(
  classifyProductSourcingFailure(
    new Error("400 Unable to download content from the provided URL before the timeout.")
  ),
  "provider_image_download"
);
assert.equal(classifyProductSourcingFailure(new Error("Unexpected model error")), "other");
assert.equal(
  productSourcingTimeoutMessage(),
  "Product sourcing took longer than expected. Please try matching products again in a minute."
);
assert.equal(productSourcingGenericFailureMessage(), "Product sourcing could not complete. Please try sourcing again.");

// The OpenAI SDK's own client deadline classifies as a sourcing timeout, so a
// RITZY_TEXT_TIMEOUT_MS below the outer 45s wrapper still routes to the fallback.
assert.equal(isProductSourcingTimeoutError(new Error("Request timed out.")), true);
assert.equal(isProductSourcingTimeoutError(new Error("some other failure")), false);
console.log("product-sourcing-failure tests passed");
