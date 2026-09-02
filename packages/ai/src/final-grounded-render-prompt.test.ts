import assert from "node:assert/strict";

import { buildFinalGroundedRenderPrompt, FINAL_GROUNDED_RENDER_PROMPT_CHAR_BUDGET } from ".";

// Single-path final render prompt (S2 absorbed the V2 flag): the full design
// language stack plus the spatial placement guardrail the old V1 branch carried.

const productSummary = [
  "1. sofas: Narissa 3-Seater Fabric Sofa; room role: anchor seating; retailer: Home Centre; price: AED 3299; dimensions: W 230 x D 95 x H 80 cm; why selected: room role: anchor seating; matches ivory boucle curved sofa",
  "2. rugs: Hand-Knotted Wool Rug; room role: rug; retailer: Local Retailer; price: AED 2200; why selected: room role: rug; matches warm neutral oversized rug"
].join("\n");

const prompt = buildFinalGroundedRenderPrompt({
  roomType: "living room",
  conceptTitle: "Quiet Gallery Lounge",
  conceptDescription: "A layered warm living room concept.",
  hasConceptImage: true,
  productSummary
});

assert.match(prompt, /Ritzy final render language:/);
assert.match(prompt, /Selected concept: Quiet Gallery Lounge/);
assert.match(prompt, /source room as the architectural anchor/);
assert.match(prompt, /arranged for conversation/);
assert.match(prompt, /primary seating must be placed on a different wall or zone/);
assert.match(prompt, /sofa seat\/front should face the TV\/media wall or declared focal point/);
// The spatial placement guardrail from the retired V1 branch must survive absorption.
assert.match(prompt, /sofa-under-TV placement/);
assert.match(prompt, /TV\/media wall and primary sofa must not be on the same wall/);
assert.match(prompt, /commerce-critical visual references/);
assert.match(prompt, /highest-priority anchor items/);
assert.match(prompt, /silhouettes, color families, materials, proportions/);
assert.match(prompt, /visible distinctive features/);
assert.match(prompt, /not a promise of exact SKU reproduction/);
assert.match(prompt, /Selected catalog products, in current reference order:/);
assert.match(prompt, /Narissa 3-Seater Fabric Sofa/);
assert.match(prompt, /Ritzy enhanced image styling layer/);

const strictPreservationPrompt = buildFinalGroundedRenderPrompt({
  roomType: "living room",
  conceptTitle: "Quiet Gallery Lounge",
  productSummary,
  strictSourceRoomPreservation: true
});

assert.match(strictPreservationPrompt, /Strict source-room preservation layer/);
assert.match(strictPreservationPrompt, /Do not close, fill, remove, or invent wall openings/);
assert.match(strictPreservationPrompt, /keep that opening and sightline visible/);

// Adversarial worst case (review finding): a combined living+dining hall with a
// 14-role list of longest-audited catalogue descriptions must stay inside the
// build budget, which itself leaves headroom for the spatial-QA retry suffix
// appended downstream. Anchors lead the summary and must survive the trim.
const longDescription =
  "Crafted with a solid wood frame and premium high-density foam cushions, this piece features hand-stitched detailing, tapered legs in a rich walnut finish, and stain-resistant upholstery. ".repeat(
    9
  );
const heavySummary = Array.from({ length: 14 }, (_, index) =>
  `${index + 1}. role-${index + 1}: Valencia Fabric Corner Sofa with Ottoman ${index + 1}; room role: anchor seating; retailer: Home Centre; price: AED 3299; dimensions: W 285 x D 168 x H 92 cm; description: ${longDescription}; why selected: palette coherence with the warm neutral direction and dimension fit for the 5.2m wall`
).join("\n");

const worstCase = buildFinalGroundedRenderPrompt({
  roomType: "Living & Dining (combined hall)",
  conceptTitle: "Warm Hosting Hall",
  conceptDescription: "A layered combined living and dining hall concept with zoned lighting. ".repeat(6),
  hasConceptImage: true,
  productSummary: heavySummary,
  strictSourceRoomPreservation: true,
  spatialIntent: {
    focalPoint: "tv_media_wall",
    seatingPriority: "conversation seating for six with sightlines to the dining zone",
    diningSeatCount: 8,
    mustKeepClear: ["the corridor from the entry door", "the terrace door swing", "the radiator wall"]
  }
});
assert.ok(
  worstCase.length <= FINAL_GROUNDED_RENDER_PROMPT_CHAR_BUDGET,
  `worst-case final render prompt exceeds the budget: ${worstCase.length} > ${FINAL_GROUNDED_RENDER_PROMPT_CHAR_BUDGET}`
);
assert.match(worstCase, /1\. role-1: Valencia Fabric Corner Sofa/);
assert.match(worstCase, /Warm Hosting Hall/);

console.log("final grounded render prompt assembly tests passed");
