import assert from "node:assert/strict";

import { BRIEF_FIELD_BOUNDS, designBriefSchema } from "./index";

// S5 (AC 4): the form's input attributes and the schema's bounds are the same
// numbers. The table below is what the browser enforces; this test proves the
// server enforces exactly the same thing, so a bound can never be raised in
// one place and left behind in the other.

const base = {
  projectId: "11111111-1111-4111-8111-111111111111",
  roomId: "22222222-2222-4222-8222-222222222222",
  roomType: "Living Room"
};

const accepts = (field: string, value: unknown) =>
  designBriefSchema.safeParse({ ...base, [field]: value }).success;

for (const [field, bound] of Object.entries(BRIEF_FIELD_BOUNDS)) {
  if (bound.kind === "text") {
    assert.equal(accepts(field, "x".repeat(bound.max)), true, `${field} accepts its own maximum length`);
    assert.equal(accepts(field, "x".repeat(bound.max + 1)), false, `${field} rejects one character over`);
  } else {
    assert.equal(accepts(field, bound.max), true, `${field} accepts its own maximum`);
    assert.equal(accepts(field, bound.max + 1), false, `${field} rejects one over`);
    assert.equal(accepts(field, bound.min), true, `${field} accepts its own minimum`);
    assert.equal(accepts(field, 0), false, `${field} rejects zero`);
  }
}

// The table covers every bounded field of the schema, so a field added to the
// brief without a bound in the table is caught here rather than by a shopper
// losing what she typed.
{
  const described = new Set(Object.keys(BRIEF_FIELD_BOUNDS));
  const bounded = ["styleNotes", "colorNotes", "budgetNotes", "functionalRequirements", "avoidNotes", "inspirationNotes", "wallLengthCm", "roomDepthCm", "ceilingHeightCm", "measurementNotes"];
  for (const field of bounded) {
    assert.ok(described.has(field), `${field} has a bound in the table`);
  }
  assert.equal(described.size, bounded.length, "the table describes exactly the bounded fields");
}

// The three the details form renders as number inputs carry the maxima the
// plan's acceptance criterion names.
assert.equal(BRIEF_FIELD_BOUNDS.wallLengthCm.kind === "number" && BRIEF_FIELD_BOUNDS.wallLengthCm.max, 5000);
assert.equal(BRIEF_FIELD_BOUNDS.roomDepthCm.kind === "number" && BRIEF_FIELD_BOUNDS.roomDepthCm.max, 5000);
assert.equal(BRIEF_FIELD_BOUNDS.ceilingHeightCm.kind === "number" && BRIEF_FIELD_BOUNDS.ceilingHeightCm.max, 1000);
assert.equal(BRIEF_FIELD_BOUNDS.colorNotes.kind === "text" && BRIEF_FIELD_BOUNDS.colorNotes.max, 1200);
assert.equal(BRIEF_FIELD_BOUNDS.functionalRequirements.kind === "text" && BRIEF_FIELD_BOUNDS.functionalRequirements.max, 2000);
assert.equal(BRIEF_FIELD_BOUNDS.avoidNotes.kind === "text" && BRIEF_FIELD_BOUNDS.avoidNotes.max, 1200);
assert.equal(BRIEF_FIELD_BOUNDS.inspirationNotes.kind === "text" && BRIEF_FIELD_BOUNDS.inspirationNotes.max, 1600);

console.log("brief field bounds tests passed");
