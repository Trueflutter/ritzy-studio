import assert from "node:assert/strict";

import { finalGroundedRenderPrompt } from "@ritzy-studio/prompts";

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

assert.equal(
  basePrompt,
  [
    finalGroundedRenderPrompt.system,
    `Selected concept: Quiet Gallery Lounge`,
    `Concept notes: A layered warm living room concept.`,
    "The second input image is the approved concept image. Preserve its overall design intent while replacing invented items with the selected catalog products.",
    "Selected catalog products:",
    productSummary,
    "Generate a polished final client-facing photorealistic interior photograph.",
    "The final image must be product-grounded: main visible furniture and decor should correspond to the selected catalog products by room role, silhouette, color family, and material where possible.",
    "Do not introduce alternate sofas, armchairs, coffee tables, rugs, wall art, or decor that are not represented in the selected catalog references.",
    "Use realistic camera exposure, natural shadows, true material texture, believable furniture scale, and residential lighting.",
    "Avoid illustration, generic CGI showroom smoothness, warped furniture, and impossible reflections.",
    "Keep the shopping list as the source of truth; the image is a best-effort visual composition."
  ].join("\n")
);
assert.equal(basePrompt.includes("Ritzy final render language v2"), false);

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
