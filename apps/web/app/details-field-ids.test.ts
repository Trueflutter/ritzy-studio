import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { ASSUMPTION_SOURCE_FIELD_IDS } from "./projects/[projectId]/rooms/[roomId]/brief/details/measurement-notes";

// S5: the assumption panel finds the fields it follows by element id, which is
// a contract between two files that nothing else checks. A rename on the page,
// or a refactor that wraps the inputs in a shared component and drops the ids,
// would freeze the panel on the saved state with every suite green, so a
// shopper who has typed all three measurements would still be told the design
// is scaled from her photographs. That is the exact falsehood the panel exists
// to prevent, so the contract is asserted here rather than trusted.

const page = readFileSync(
  path.resolve(__dirname, "projects/[projectId]/rooms/[roomId]/brief/details/page.tsx"),
  "utf8"
);

for (const id of Object.values(ASSUMPTION_SOURCE_FIELD_IDS)) {
  assert.ok(page.includes(`id="${id}"`), `the details page renders a field with id="${id}", which the assumption panel reads`);
}

// The measurement ids are the ones that must also carry a name, because the
// panel reads them live AND the action reads them on submit.
for (const id of [ASSUMPTION_SOURCE_FIELD_IDS.wall, ASSUMPTION_SOURCE_FIELD_IDS.depth, ASSUMPTION_SOURCE_FIELD_IDS.ceiling]) {
  assert.ok(page.includes(`name="${id}"`), `the details page submits ${id}`);
}

console.log("details field id contract tests passed");
