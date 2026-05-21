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

assert.deepEqual(
  baseImagePrompt.split("\n"),
  [
    "Create a warm living room concept.",
    "Use the uploaded room photo as the base image.",
    "Use the uploaded inspiration images as style references for palette, materials, atmosphere, and composition. Do not reproduce them exactly.",
    "Preserve visible architecture, walls, windows, doors, ceiling details, AC vents, sockets, built-ins, and fixed bathroom fixtures where present.",
    "Redesign movable furniture, lighting, textiles, accessories, and decor according to the concept direction.",
    "Output must look like a photorealistic editorial interior photograph, not an illustration, 3D showroom render, sketch, or mood board.",
    "Use physically plausible scale, natural shadows, realistic upholstery grain, wood texture, rug fibers, wall finish, and lighting falloff.",
    "Keep the source-photo camera perspective and lens feel. Do not add text labels, prices, product names, or retailer claims."
  ]
);

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
assert.match(v2ImagePrompt, /corrected verticals/);
assert.match(v2ImagePrompt, /fake product labels/);

console.log("initial concept prompt assembly tests passed");
