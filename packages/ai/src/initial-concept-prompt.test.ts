import assert from "node:assert/strict";

import { initialConceptPrompt } from "@ritzy-studio/prompts";

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
    "Design the living room as a layered editorial residential seating group: sofa and lounge chairs arranged for conversation, anchored by a generously sized rug, usable coffee table and side tables, full-height window treatment where visible, layered warm lighting, scaled artwork or focal wall, and restrained styled surfaces with books, ceramics, tray, branches, and tactile cushions. Make it collected-not-matched, materially rich, and residential in scale.",
    "Ritzy living room blueprint: assume a complete Dubai living room includes a TV/media focal wall and media console by default, plus sofa or sectional, secondary seating, coffee table, generous rug, side tables, layered lamps or sconces, wall art or mirror/wall treatment, cushions, throws, greenery, and edited decor. Do not omit the TV/media layer unless the brief explicitly asks for no TV, a formal TV-free salon, a protected existing media wall, or a source-room constraint makes it impossible. Treat the TV and console as residential and elegant: widescreen TV, refined low console or built-in media unit, concealed cable logic, calm styling, and proportionate placement rather than a showroom electronics wall.",
    "Sculptural Minimal: sculptural minimal style with generous negative space, monolithic forms, warm plaster, honed stone, pale wood, tactile textiles, one sculptural light, and precise proportions.\nWarm Contemporary Gallery: warm contemporary gallery style with plaster walls, walnut, travertine, tactile upholstery, oversized art, sculptural lighting, edited negative space, and collected ceramics."
  ].join("\n")
);

const baseImagePrompt = buildInitialConceptImagePrompt({
  generationPrompt: "Create a warm living room concept.",
  roomType: "living room",
  hasInspirationImages: true,
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
assert.match(baseImagePrompt, /TV\/media focal wall and media console by default/);
assert.match(baseImagePrompt, /Preserve source-room architecture exactly/);

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
assert.match(v2ImagePrompt, /widescreen TV/);
assert.match(v2ImagePrompt, /corrected verticals/);
assert.match(v2ImagePrompt, /fake product labels/);

console.log("initial concept prompt assembly tests passed");
