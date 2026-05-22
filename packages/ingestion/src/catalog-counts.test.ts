import assert from "node:assert/strict";

import { countProductCategoriesFromPages, type CategoryCountRow } from "./catalog-counts";

const pages: CategoryCountRow[][] = [
  [
    { category_normalized: "sofas" },
    { category_normalized: "lighting" }
  ],
  [
    { category_normalized: "lighting" },
    { category_normalized: null }
  ],
  [{ category_normalized: "storage" }]
];
const requestedRanges: Array<[number, number]> = [];

const counts = await countProductCategoriesFromPages(async (from, to) => {
  requestedRanges.push([from, to]);
  return {
    data: pages.shift() ?? [],
    error: null
  };
}, 2);

assert.deepEqual(requestedRanges, [
  [0, 1],
  [2, 3],
  [4, 5]
]);
assert.deepEqual(counts, {
  lighting: 2,
  sofas: 1,
  storage: 1,
  uncategorized: 1
});

console.log("catalog count tests passed");
