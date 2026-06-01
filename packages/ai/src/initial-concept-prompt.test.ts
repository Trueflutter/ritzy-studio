import assert from "node:assert/strict";

import { initialConceptPrompt, roomBlueprintDefaultsLanguage, roomDesignLanguage } from "@ritzy-studio/prompts";

import { buildInitialConceptImagePrompt, buildInitialConceptSystemPrompt } from ".";

const baseSystemPrompt = buildInitialConceptSystemPrompt({
  roomType: "living room",
  styleSlugs: ["modern"],
  useInteriorPromptV2: false
});

assert.equal(baseSystemPrompt, initialConceptPrompt.system);
assert.equal(baseSystemPrompt.includes("Ritzy interior design language v2"), false);

const v2SystemPrompt = buildInitialConceptSystemPrompt({
  roomType: "living room",
  styleSlugs: ["modern"],
  useInteriorPromptV2: true
});

assert.equal(
  v2SystemPrompt,
  [
    initialConceptPrompt.system,
    "Ritzy interior design language v2:",
    "Preserve the uploaded source room as the architectural anchor. Keep visible walls, windows, doors, ceiling plane, AC vents, switches, sockets, built-ins, openings, floor boundaries, camera perspective, and residential scale stable. Do not invent architectural renovations, change room proportions, or infer exact dimensions unless the user explicitly provides them.",
    "Generate high-end editorial residential interior photography, not an illustration, sketch, mood board, or CGI showroom. Use physically plausible scale, corrected verticals, motivated daylight and practical lighting, realistic global illumination, contact shadows, balanced exposure, and preserved window highlights. Show tactile real materials: wool pile, linen weave, upholstery texture, wood grain direction, honed stone, plaster variation, brushed metal, glass reflections, roughness variation, softened bevels, curtain folds, cushion compression, and subtle lived-in asymmetry. Avoid fisheye distortion, warped furniture, floating objects, impossible reflections, fake labels, visible generated text, showroom sterility, generic beige luxury, and overdecorated surfaces.",
    roomDesignLanguage("living room"),
    roomBlueprintDefaultsLanguage("living room"),
    "Sculptural Minimal: sculptural minimal style with generous negative space, monolithic forms, warm plaster, honed stone, pale wood, tactile textiles, one sculptural light, and precise proportions.\nWarm Contemporary Gallery: warm contemporary gallery style with plaster walls, walnut, travertine, tactile upholstery, oversized art, sculptural lighting, edited negative space, and collected ceramics."
  ].join("\n")
);

const baseImagePrompt = buildInitialConceptImagePrompt({
  generationPrompt: "Create a warm living room concept.",
  roomType: "living room",
  hasInspirationImages: true,
  catalogueProductSummary:
    "1. sofa: ivory boucle sofa; color: ivory; material: boucle; why selected: color family matches role brief",
  styleSlugs: ["modern"],
  useInteriorPromptV2: false
});

assert.match(baseImagePrompt, /Create a warm living room concept/);
assert.match(baseImagePrompt, /Use the uploaded room photo as the base image/);
assert.match(baseImagePrompt, /Ritzy enhanced image styling layer/);
assert.match(baseImagePrompt, /editorial residential photography/);
assert.match(baseImagePrompt, /high-end but livable Dubai villa or townhouse/);
assert.match(baseImagePrompt, /layered lighting/);
assert.match(baseImagePrompt, /wall art, mirrors, paneling, shelves/);
assert.match(baseImagePrompt, /correctly scaled rugs/);
assert.match(baseImagePrompt, /TV\/media focal wall with an elegant media console/);
assert.match(baseImagePrompt, /TV\/media wall and primary sofa must not be on the same wall/);
assert.match(baseImagePrompt, /sofa directly under or against the TV\/media wall facing away from it/);
assert.match(baseImagePrompt, /Preserve source-room architecture exactly/);
assert.match(baseImagePrompt, /Catalogue-grounded concept references/);
assert.match(baseImagePrompt, /ivory boucle sofa/);
assert.match(baseImagePrompt, /Do not invent alternate anchor furniture/);

const strictPreservationImagePrompt = buildInitialConceptImagePrompt({
  generationPrompt: "Create a warm living room concept.",
  roomType: "living room",
  strictSourceRoomPreservation: true
});

assert.match(strictPreservationImagePrompt, /Strict source-room preservation layer/);
assert.match(strictPreservationImagePrompt, /Do not close, fill, remove, or invent wall openings/);
assert.match(strictPreservationImagePrompt, /keep that opening and sightline visible/);

const v2ImagePrompt = buildInitialConceptImagePrompt({
  generationPrompt: "Create a warm living room concept.",
  roomType: "living room",
  hasInspirationImages: true,
  styleSlugs: ["modern"],
  useInteriorPromptV2: true
});

assert.match(v2ImagePrompt, /Sculptural Minimal/);
assert.match(v2ImagePrompt, /Warm Contemporary Gallery/);
assert.match(v2ImagePrompt, /source room as the architectural anchor/);
assert.match(v2ImagePrompt, /arranged for conversation/);
assert.match(v2ImagePrompt, /primary seating must be placed on a different wall or zone/);
assert.match(v2ImagePrompt, /sofa seat\/front should face the TV\/media wall or declared focal point/);
assert.match(v2ImagePrompt, /widescreen TV/);
assert.match(v2ImagePrompt, /corrected verticals/);
assert.match(v2ImagePrompt, /fake product labels/);

console.log("initial concept prompt assembly tests passed");
