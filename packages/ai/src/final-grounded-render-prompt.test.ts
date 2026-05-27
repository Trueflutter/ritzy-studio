import assert from "node:assert/strict";

import { buildFinalGroundedRenderPrompt } from ".";

const productSummary = [
  "1. sofas: Narissa 3-Seater Fabric Sofa; room role: anchor seating; retailer: Home Centre; price: AED 3299; dimensions: W 230 x D 95 x H 80 cm; why selected: room role: anchor seating; matches ivory boucle curved sofa",
  "2. rugs: Hand-Knotted Wool Rug; room role: rug; retailer: Local Retailer; price: AED 2200; why selected: room role: rug; matches warm neutral oversized rug"
].join("\n");

const basePrompt = buildFinalGroundedRenderPrompt({
  roomType: "living room",
  conceptTitle: "Quiet Gallery Lounge",
  conceptDescription: "A layered warm living room concept.",
  hasConceptImage: true,
  productSummary,
  useFinalRenderPromptV2: false
});

assert.match(basePrompt, /Selected concept: Quiet Gallery Lounge/);
assert.match(basePrompt, /Selected catalog products:/);
assert.match(basePrompt, /Ritzy enhanced image styling layer/);
assert.match(basePrompt, /editorial residential photography/);
assert.match(basePrompt, /high-end but livable Dubai villa or townhouse/);
assert.match(basePrompt, /layered lighting/);
assert.match(basePrompt, /wall art, mirrors, paneling, shelves/);
assert.match(basePrompt, /correctly scaled rugs/);
assert.match(basePrompt, /preserve selected catalog product silhouette, color family, material, scale/);
assert.equal(basePrompt.includes("Ritzy final render language v2"), false);

const strictPreservationPrompt = buildFinalGroundedRenderPrompt({
  roomType: "living room",
  conceptTitle: "Quiet Gallery Lounge",
  productSummary,
  strictSourceRoomPreservation: true
});

assert.match(strictPreservationPrompt, /Strict source-room preservation layer/);
assert.match(strictPreservationPrompt, /Do not close, fill, remove, or invent wall openings/);
assert.match(strictPreservationPrompt, /keep that opening and sightline visible/);

const v2Prompt = buildFinalGroundedRenderPrompt({
  roomType: "living room",
  conceptTitle: "Quiet Gallery Lounge",
  conceptDescription: "A layered warm living room concept.",
  hasConceptImage: true,
  productSummary,
  useFinalRenderPromptV2: true
});

assert.match(v2Prompt, /Ritzy final render language v2/);
assert.match(v2Prompt, /source room as the architectural anchor/);
assert.match(v2Prompt, /arranged for conversation/);
assert.match(v2Prompt, /commerce-critical visual references/);
assert.match(v2Prompt, /highest-priority anchor items/);
assert.match(v2Prompt, /silhouettes, color families, materials, proportions/);
assert.match(v2Prompt, /visible distinctive features/);
assert.match(v2Prompt, /not a promise of exact SKU reproduction/);
assert.match(v2Prompt, /Selected catalog products, in current reference order:/);
assert.match(v2Prompt, /Narissa 3-Seater Fabric Sofa/);

console.log("final grounded render prompt assembly tests passed");
