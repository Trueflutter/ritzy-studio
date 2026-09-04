import assert from "node:assert/strict";

import { buildInitialConceptImagePrompt, INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET } from "./index";

// Adversarial worst case, mirrored from the live pipeline's maxima: the direction
// model's generationPrompt is schema-capped at 2,800 chars; combined-hall room type
// + full spatial intent + 5 style modules is the heaviest fixed language stack.
// Concept-first (S2): the catalogue summary no longer exists in this prompt, so the
// generation prompt is the only variable input the clamp can trim.
//
// Anchored concepts (S3b) added a clause the shipped prompt now always carries,
// naming each anchor's role. The worst case has to carry it too, or this proof
// covers a shape that no longer ships and the next addition to the fixed
// language stack passes here while trimming the shopper's concept direction in
// production.
const worstCase = {
  generationPrompt: "A warm contemporary living and dining hall concept with layered lighting. "
    .repeat(40)
    .slice(0, 2800),
  roomType: "Living & Dining (combined hall)",
  hasInspirationImages: true,
  anchorProducts: [
    { roleLabel: "anchor seating for the conversation group facing the window wall" },
    { roleLabel: "the eight-seat dining table under the pendant run" },
    { roleLabel: "the accent lounge chair beside the terrace doors" },
    { roleLabel: "the large flatweave rug under the conversation group" }
  ],
  styleSlugs: ["organic-contemporary", "japandi", "quiet-luxury", "scandinavian", "mid-century"],
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

// The clamp degrades the variable input only; the concept direction's head survives,
// and the full generation prompt should now fit without any trimming at all.
assert.ok(worstPrompt.startsWith("A warm contemporary living and dining hall concept"));
assert.ok(
  worstPrompt.includes(worstCase.generationPrompt),
  "without a catalogue summary the schema-capped generation prompt must survive untrimmed"
);

// Hostile spatial intent (reviewer repro): a 20k-char mustKeepClear entry must not blow
// the prompt past the budget — bounded in the prompt layer even when parseSpatialIntent
// is bypassed and intent is assembled directly.
const hostileIntentPrompt = buildInitialConceptImagePrompt({
  ...worstCase,
  spatialIntent: {
    ...worstCase.spatialIntent,
    mustKeepClear: ["x".repeat(20_000), "the terrace door swing"]
  }
});
assert.ok(
  hostileIntentPrompt.length <= INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET,
  `hostile mustKeepClear blew the budget: ${hostileIntentPrompt.length}`
);

// A modest everyday case passes through untouched.
const modest = buildInitialConceptImagePrompt({
  generationPrompt: "A calm bedroom concept with walnut accents.",
  roomType: "Bedroom"
});
assert.ok(modest.includes("A calm bedroom concept with walnut accents."));

console.log("initial concept prompt budget tests passed");
console.log(`worst-case prompt: ${worstPrompt.length} chars (budget ${INITIAL_CONCEPT_IMAGE_PROMPT_CHAR_BUDGET})`);
