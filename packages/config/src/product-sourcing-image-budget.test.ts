import assert from "node:assert/strict";

import {
  DEFAULT_PRODUCT_SOURCING_IMAGES_PER_ROLE,
  DEFAULT_PRODUCT_SOURCING_IMAGE_TOTAL,
  productSourcingImageBudget
} from "./index";

// Visual sourcing is visual by default: images are on unless configured off.
assert.deepEqual(productSourcingImageBudget({}), {
  perRole: DEFAULT_PRODUCT_SOURCING_IMAGES_PER_ROLE,
  total: DEFAULT_PRODUCT_SOURCING_IMAGE_TOTAL
});
assert.ok(DEFAULT_PRODUCT_SOURCING_IMAGES_PER_ROLE > 0);
assert.ok(DEFAULT_PRODUCT_SOURCING_IMAGE_TOTAL >= DEFAULT_PRODUCT_SOURCING_IMAGES_PER_ROLE);

assert.deepEqual(
  productSourcingImageBudget({ RITZY_PRODUCT_SOURCING_IMAGES_PER_ROLE: "2", RITZY_PRODUCT_SOURCING_IMAGE_TOTAL: "10" }),
  { perRole: 2, total: 10 }
);
// Zero is an explicit off switch, never a parse accident.
assert.deepEqual(productSourcingImageBudget({ RITZY_PRODUCT_SOURCING_IMAGES_PER_ROLE: "0" }).perRole, 0);
// Garbage, negatives and blanks fall back to the defaults.
assert.equal(productSourcingImageBudget({ RITZY_PRODUCT_SOURCING_IMAGES_PER_ROLE: "lots" }).perRole, DEFAULT_PRODUCT_SOURCING_IMAGES_PER_ROLE);
assert.equal(productSourcingImageBudget({ RITZY_PRODUCT_SOURCING_IMAGE_TOTAL: "-4" }).total, DEFAULT_PRODUCT_SOURCING_IMAGE_TOTAL);
assert.equal(productSourcingImageBudget({ RITZY_PRODUCT_SOURCING_IMAGE_TOTAL: "  " }).total, DEFAULT_PRODUCT_SOURCING_IMAGE_TOTAL);
assert.equal(productSourcingImageBudget({ RITZY_PRODUCT_SOURCING_IMAGE_TOTAL: "3.5" }).total, DEFAULT_PRODUCT_SOURCING_IMAGE_TOTAL);

console.log("product-sourcing-image-budget tests passed");
