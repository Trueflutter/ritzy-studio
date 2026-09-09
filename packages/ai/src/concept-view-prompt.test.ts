import assert from "node:assert/strict";

import { conceptViewCameraLanguage, conceptViewConsistencyLanguage } from "@ritzy-studio/prompts";

import { buildConceptViewPrompt } from ".";

const reversePrompt = buildConceptViewPrompt({
  roomType: "living room",
  viewKey: "reverse_wide",
  conceptTitle: "Quiet Luxury Living",
  conceptDescription: "Warm neutral living room",
  conceptGenerationPrompt: "Design a warm neutral living room."
});

assert.match(reversePrompt, /THE SAME designed room/);
assert.match(reversePrompt, /must be kept identical/);
assert.match(reversePrompt, /looking back across the seating group/);
assert.match(reversePrompt, /Approved concept: Quiet Luxury Living/);
assert.match(reversePrompt, /never to redesign/);
assert.match(reversePrompt, /editorial residential interior photography/);
assert.match(reversePrompt, /Do not add text labels/);

const detailPrompt = buildConceptViewPrompt({
  roomType: "living room",
  viewKey: "anchor_detail",
  conceptTitle: "Quiet Luxury Living"
});

assert.match(detailPrompt, /tight detail vignette/);
assert.match(detailPrompt, /Crop well inside the full furniture group/);
assert.match(detailPrompt, /one end of the primary sofa/);
assert.equal(detailPrompt.includes("Concept notes:"), false);

const combinedReverse = conceptViewCameraLanguage("Living & Dining", "reverse_wide");
assert.match(combinedReverse, /dining zone/);
assert.match(combinedReverse, /divider/);

const bedroomDetail = conceptViewCameraLanguage("Bedroom", "anchor_detail");
assert.match(bedroomDetail, /one side of the headboard/);

const diningReverse = conceptViewCameraLanguage("Dining Room", "reverse_wide");
assert.match(diningReverse, /opposite side of the dining table/);

assert.match(conceptViewConsistencyLanguage(), /identical physical room/);

// S4: the closed vocabulary gained a focal wide view. The concept stage keeps
// its two fixed keys, but the shared camera language must answer for the new
// key so the final render's views can use it.
const focalPrompt = buildConceptViewPrompt({
  roomType: "living room",
  viewKey: "focal_wide",
  conceptTitle: "Quiet Luxury Living",
  focalLabel: "the TV and media wall"
});
assert.match(focalPrompt, /the TV and media wall/);
assert.match(focalPrompt, /THE SAME designed room/);

console.log("concept view prompt assembly tests passed");
