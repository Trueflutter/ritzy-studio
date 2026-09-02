import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { PRODUCT_CONSISTENCY_THRESHOLD } from "@ritzy-studio/domain";

// The app pre-selects a product for the shopper only at or above the committed
// similarity bar, and the critique harness fails the product_consistency check
// below the number written in its checklist. Those have to be one number: if
// the app chose at a bar the gate would fail, every gate run would fail on
// pieces the app presented as its own choice. The harness is a standalone
// script with no workspace imports, so this is where the two are tied.
const checklist = readFileSync(
  path.join(process.cwd(), "../../scripts/critique-harness/checklist.md"),
  "utf8"
);
const stated = checklist.match(/similarity at or above (\d+(?:\.\d+)?)/);
assert.ok(stated, "checklist.md must state the product_consistency threshold");
assert.equal(
  Number(stated?.[1]),
  PRODUCT_CONSISTENCY_THRESHOLD,
  "the harness checklist and the sourcing bar must be the same number"
);
assert.ok(PRODUCT_CONSISTENCY_THRESHOLD > 0 && PRODUCT_CONSISTENCY_THRESHOLD <= 1);

console.log("product consistency threshold tests passed");
