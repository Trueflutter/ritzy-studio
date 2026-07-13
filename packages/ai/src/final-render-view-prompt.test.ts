import assert from "node:assert/strict";

import { conceptViewCameraLanguage, finalRenderViewConsistencyLanguage } from "@ritzy-studio/prompts";

import { buildFinalRenderViewPrompt } from ".";

const reversePrompt = buildFinalRenderViewPrompt({
  roomType: "living room",
  viewKey: "reverse_wide",
  conceptTitle: "Cognac Calm Living",
  conceptDescription: "Warm cognac and walnut living room"
});

// Truth-separation consistency: the reference is the finished render with the real products, and
// every purchasable piece must be reproduced identically (no restyle, no invented decor).
assert.match(reversePrompt, /THE SAME finished room/);
assert.match(reversePrompt, /exact products the client selected/);
assert.match(reversePrompt, /reproduced identically/);
assert.match(reversePrompt, /Do not substitute, recolor, restyle, add, or remove any product/);
// Shares the concept-view camera language (same room geometry, new angle).
assert.match(reversePrompt, /looking back across the seating group/);
assert.match(reversePrompt, /Room design: Cognac Calm Living/);
assert.match(reversePrompt, /Design notes: Warm cognac and walnut living room/);
assert.match(reversePrompt, /editorial residential interior photography/);
assert.match(reversePrompt, /Do not add text labels/);

const detailPrompt = buildFinalRenderViewPrompt({
  roomType: "living room",
  viewKey: "anchor_detail",
  conceptTitle: "Cognac Calm Living"
});

assert.match(detailPrompt, /tight detail vignette/);
assert.match(detailPrompt, /Crop well inside the full furniture group/);
assert.match(detailPrompt, /one end of the primary sofa/);
assert.equal(detailPrompt.includes("Design notes:"), false);

// The camera language is genuinely shared with concept views (regression guard).
assert.equal(
  conceptViewCameraLanguage("Dining Room", "reverse_wide"),
  conceptViewCameraLanguage("dining", "reverse_wide")
);
assert.match(finalRenderViewConsistencyLanguage(), /identical finished room/);

console.log("final render view prompt assembly tests passed");
