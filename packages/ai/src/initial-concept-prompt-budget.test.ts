import assert from "node:assert/strict";

import {
  buildInitialConceptImagePrompt,
  catalogueProductImageSummary,
  INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET
} from "./index";

// Adversarial worst case, mirrored from the live pipeline's maxima: the direction model's
// generationPrompt is schema-capped at 2,800 chars; the grounding loop selects up to 6
// anchors; the hosted catalogue's longest description is 1,631 chars (audited 2026-07-13);
// combined-hall room type + full spatial intent + 5 style modules is the heaviest fixed
// language stack.
const longDescription =
  "Crafted with a solid wood frame and premium high-density foam cushions, this piece features hand-stitched detailing, tapered legs in a rich walnut finish, and stain-resistant upholstery. ".repeat(
    9
  );

const anchors = Array.from({ length: 6 }, (_, index) => ({
  roleLabel: `anchor role ${index + 1} with a descriptive label`,
  name: `Valencia Fabric Corner Sofa with Ottoman and Adjustable Headrests, Beige/Walnut ${index + 1}`,
  category: "seating",
  retailerName: "Home Centre",
  description: longDescription,
  color: "warm beige with cognac accents",
  material: "kiln-dried hardwood, linen blend upholstery, high-density foam",
  styleTags: ["organic-contemporary", "scandinavian-warmth", "japandi", "mid-century-modern"],
  colorTags: ["beige", "cognac", "walnut", "cream", "sand"],
  materialTags: ["linen", "walnut-wood", "boucle", "rattan", "brushed-brass"],
  dimensions: "W 285 cm x D 168 cm x H 92 cm",
  selectionReason:
    "room role: primary seating; strong palette coherence with the concept's warm neutral direction; silhouette matches the requested low-profile organic form; material evidence: linen blend, walnut; budget fit within allocated band; dimension fit for the 5.2m wall"
}));

const imageSummary = catalogueProductImageSummary(anchors);

// The slimmed summary keeps visual facts and drops provenance.
assert.ok(imageSummary.includes("description:"));
assert.ok(!imageSummary.includes("why selected"));
assert.ok(imageSummary.length < 5_000, `slimmed summary unexpectedly large: ${imageSummary.length}`);

const worstCase = {
  generationPrompt: "A warm contemporary living and dining hall concept with layered lighting. "
    .repeat(40)
    .slice(0, 2800),
  roomType: "Living & Dining (combined hall)",
  hasInspirationImages: true,
  catalogueProductSummary: imageSummary,
  styleSlugs: ["organic-contemporary", "japandi", "quiet-luxury", "scandinavian", "mid-century"],
  useInteriorPromptV2: true,
  strictSourceRoomPreservation: true,
  spatialIntent: {
    focalPoint: "the full-height window wall with the framed garden view beyond the terrace doors",
    seatingPriority:
      "conversation seating for six facing the focal window wall with clear sightlines to the dining zone",
    diningSeatCount: 8,
    mustKeepClear: [
      "the corridor from the entry door to the kitchen pass-through",
      "the terrace door swing",
      "the radiator wall"
    ]
  },
  measurements: { wallLengthCm: 620, roomDepthCm: 480, ceilingHeightCm: 310 },
  additionalRoomPhotoCount: 2
};

const worstPrompt = buildInitialConceptImagePrompt(worstCase);
assert.ok(
  worstPrompt.length <= INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET,
  `worst-case prompt exceeds the Evolink budget: ${worstPrompt.length} > ${INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET}`
);

// The clamp degrades variable inputs only; the concept direction's head always survives.
// (In this adversarial maximum the anchor summary may be trimmed away entirely — the
// anchors still reach the renderer as reference images.)
assert.ok(worstPrompt.startsWith("A warm contemporary living and dining hall concept"));

// A realistic heavy case — p99 catalogue descriptions, two style modules, a typical
// generation prompt — must keep its anchors verbatim with no clamping.
const heavyRealistic = buildInitialConceptImagePrompt({
  ...worstCase,
  generationPrompt: worstCase.generationPrompt.slice(0, 1800),
  styleSlugs: ["organic-contemporary", "japandi"],
  strictSourceRoomPreservation: false,
  catalogueProductSummary: catalogueProductImageSummary(
    anchors.map((anchor) => ({ ...anchor, description: anchor.description.slice(0, 1186) }))
  )
});
assert.ok(heavyRealistic.length <= INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET);
assert.ok(heavyRealistic.includes("Valencia Fabric Corner Sofa"));
assert.ok(heavyRealistic.includes("6. anchor role 6"), "all six anchors must survive a realistic heavy case");

// The raw (untruncated) worst case would blow the cap — the clamp must bound it anyway.
const rawSummary = anchors
  .map(
    (product, index) =>
      `${index + 1}. ${product.roleLabel}: ${product.name}; description: ${product.description}; why selected: ${product.selectionReason}`
  )
  .join("\n");
const unclamped = buildInitialConceptImagePrompt({ ...worstCase, catalogueProductSummary: rawSummary });
assert.ok(
  unclamped.length <= INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET,
  "clamp must bound even a raw full-detail summary"
);

// A modest everyday case passes through untouched.
const modest = buildInitialConceptImagePrompt({
  generationPrompt: "A calm bedroom concept with walnut accents.",
  roomType: "Bedroom",
  useInteriorPromptV2: true
});
assert.ok(modest.includes("A calm bedroom concept with walnut accents."));

console.log("initial concept prompt budget tests passed");
console.log(`worst-case prompt: ${worstPrompt.length} chars (budget ${INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET})`);
