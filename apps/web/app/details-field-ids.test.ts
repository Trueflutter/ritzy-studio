import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

import { BRIEF_FIELD_BOUNDS } from "@ritzy-studio/domain";

import {
  ASSUMPTION_SOURCE_FIELD_IDS,
  assumptionNotesFrom
} from "./projects/[projectId]/rooms/[roomId]/brief/details/measurement-notes";

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

// The refusal banner links to `#<field name>`, so every refusable field this
// page renders has to carry its own name as its id or the link lands nowhere
// and the shopper is back to hunting for the field (design review).
for (const field of [
  "colorNotes",
  "functionalRequirements",
  "avoidNotes",
  "inspirationNotes",
  "mustKeepClear",
  "wallLengthCm",
  "roomDepthCm",
  "ceilingHeightCm"
] as const) {
  assert.ok(page.includes(`id="${field}"`), `the details page renders ${field} as an anchor target for the refusal banner`);
  assert.ok(BRIEF_FIELD_BOUNDS[field] !== undefined, `${field} is a bounded field`);
}

// Every field a refusal can name has to be MARKED, or the shopper is told an
// answer was refused and no input on the page says which (correctness review
// found the three measurements in exactly that state).
for (const field of [
  "colorNotes",
  "functionalRequirements",
  "avoidNotes",
  "inspirationNotes",
  "wallLengthCm",
  "roomDepthCm",
  "ceilingHeightCm"
] as const) {
  assert.ok(
    page.includes(`fieldErrorClass("${field}", refusedFields)`),
    `the details page marks ${field} when a refusal names it`
  );
  assert.ok(page.includes(`<FieldError field="${field}"`), `and renders its message`);
}

// Tests review, mutation-verified: deleting a maxLength or a max from the page
// left every suite green, because the only assertions were that the getter
// returns what the table holds. The bounds have to be asserted where they are
// rendered, or the form-typography work can drop one and a shopper loses a
// whole submission to a limit her browser never showed her.
for (const field of ["colorNotes", "functionalRequirements", "avoidNotes", "inspirationNotes", "mustKeepClear"] as const) {
  assert.ok(
    page.includes(`maxLength={briefTextAttributes("${field}").maxLength}`),
    `the details page renders the schema's maxLength on ${field}`
  );
  assert.equal(BRIEF_FIELD_BOUNDS[field].kind, "text");
}
for (const field of ["wallLengthCm", "roomDepthCm", "ceilingHeightCm"] as const) {
  assert.ok(page.includes(`max={briefNumberAttributes("${field}").max}`), `the details page renders the schema's max on ${field}`);
  assert.ok(page.includes(`min={briefNumberAttributes("${field}").min}`), `and its min`);
}

// The live read, against a stub accessor rather than a browser: this is where
// the panel's honesty lives, and the listener wiring around it is not what
// would break (tests review).
{
  const stub = (values: Record<string, string>) => (id: string) => values[id] ?? null;

  const nothing = assumptionNotesFrom(stub({}), "Living Room");
  assert.ok(nothing.some((note) => /scaled from your photographs/.test(note)));
  assert.ok(nothing.some((note) => /TV\/media wall/.test(note)), "an unchosen focal point is assumed aloud");

  // The case the panel exists for: she has typed all three and chosen a
  // fireplace, so neither assumption may still be asserted.
  const typed = assumptionNotesFrom(
    stub({ wallLengthCm: "520", roomDepthCm: "410", ceilingHeightCm: "300", focalPoint: "fireplace" }),
    "Living Room"
  );
  assert.deepEqual(typed, [], "nothing is assumed once she has answered");

  // A control that stops being an input or a select reads as absent, which is
  // the silent freeze this extraction makes visible.
  const unreadable = assumptionNotesFrom(stub({ wallLengthCm: "520", roomDepthCm: "410", ceilingHeightCm: "300" }), "Living Room");
  assert.ok(unreadable.some((note) => /TV\/media wall/.test(note)), "an unreadable focal control is assumed, not invented");
}

console.log("details field id contract tests passed");
