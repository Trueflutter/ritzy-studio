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
assert.match(reversePrompt, /Do not substitute, recolor, restyle or remove any product/);
assert.match(reversePrompt, /do not add any product other than the ones this view is told to show/);
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

// S4 (AC 9): a photo-anchored focal view names the first image as the real
// room from this camera and the second as the design; product references are
// named as the last images; must-show roles are spelled out; an unanchored
// view carries none of the photo language.
const anchoredFocal = buildFinalRenderViewPrompt({
  roomType: "living room",
  viewKey: "focal_wide",
  conceptTitle: "Cognac Calm Living",
  focalLabel: "the TV and media wall",
  anchoredToPhoto: true,
  productReferenceCount: 2,
  mustShowLabels: ["the TV and media wall (wall-mounted TV, low media console)", "large abstract painting"]
});
assert.match(anchoredFocal, /first input image is a photograph of the real room/);
assert.match(anchoredFocal, /second input image/);
assert.match(anchoredFocal, /the TV and media wall/);
assert.match(anchoredFocal, /last 2 input images/);
assert.match(anchoredFocal, /This view must clearly show: the TV and media wall \(wall-mounted TV, low media console\), large abstract painting\./);
assert.match(anchoredFocal, /THE SAME finished room/);

// Review fix: an ANCHORED reverse view must not tell the camera to look toward
// "the first photo", which is now the anchored photograph, its own position.
const anchoredReverse = buildFinalRenderViewPrompt({
  roomType: "living room",
  viewKey: "reverse_wide",
  conceptTitle: "Cognac Calm Living",
  anchoredToPhoto: true,
  productReferenceCount: 0
});
assert.match(anchoredReverse, /first input image is a photograph of the real room/);
assert.equal(anchoredReverse.includes("the first photo"), false);
assert.match(anchoredReverse, /toward the wall the hero render was taken from/);
assert.match(
  buildFinalRenderViewPrompt({ roomType: "Living & Dining", viewKey: "reverse_wide", conceptTitle: "Hall", anchoredToPhoto: true, productReferenceCount: 0 }),
  /toward where the hero render was taken/
);

const unanchored = buildFinalRenderViewPrompt({
  roomType: "living room",
  viewKey: "reverse_wide",
  conceptTitle: "Cognac Calm Living",
  anchoredToPhoto: false,
  productReferenceCount: 0
});
assert.equal(unanchored.includes("photograph of the real room"), false);
assert.equal(unanchored.includes("input images are photographs of the exact products"), false);
assert.match(unanchored, /reference image is the final rendered room/);

console.log("final render view prompt assembly tests passed");
