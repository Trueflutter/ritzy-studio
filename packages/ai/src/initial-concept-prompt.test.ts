import assert from "node:assert/strict";

import { initialConceptPrompt, roomBlueprintDefaultsLanguage, roomDesignLanguage } from "@ritzy-studio/prompts";

import { buildInitialConceptImagePrompt, buildInitialConceptSystemPrompt } from ".";

// Concept-first prompt architecture (S2): one path, no flags, no pre-approval
// catalogue anchors. The system prompt carries the full design language plus the
// palette-register guardrail; the image prompt mirrors it.

const systemPrompt = buildInitialConceptSystemPrompt({
  roomType: "living room",
  styleSlugs: ["modern"]
});

assert.ok(systemPrompt.startsWith(initialConceptPrompt.system));
assert.match(systemPrompt, /Ritzy interior design language:/);
assert.match(systemPrompt, /source room as the architectural anchor/);
assert.match(systemPrompt, /editorial residential interior photography/);
assert.equal(systemPrompt.includes(roomDesignLanguage("living room")), true);
assert.equal(systemPrompt.includes(roomBlueprintDefaultsLanguage("living room")), true);
assert.match(systemPrompt, /Sculptural Minimal/);
// The palette-register guardrail: derived from the brief, never defaulted.
assert.match(systemPrompt, /Palette and material register:/);
assert.match(systemPrompt, /Never fall back to a generic beige-brown scheme by default/);
assert.match(systemPrompt, /cool, dark, saturated, or bold colour, commit to that register fully/);
assert.match(systemPrompt, /choose ONE deliberate register/);
assert.match(systemPrompt, /may never appear as a dominant surface/);

const imagePrompt = buildInitialConceptImagePrompt({
  generationPrompt: "Create a warm living room concept.",
  roomType: "living room",
  hasInspirationImages: true,
  styleSlugs: ["modern"]
});

assert.match(imagePrompt, /Create a warm living room concept/);
assert.match(imagePrompt, /Use the uploaded room photo as the base image/);
assert.match(imagePrompt, /Use the uploaded inspiration images as style references/);
assert.match(imagePrompt, /Sculptural Minimal/);
assert.match(imagePrompt, /source room as the architectural anchor/);
assert.match(imagePrompt, /arranged for conversation/);
assert.match(imagePrompt, /primary seating must be placed on a different wall or zone/);
assert.match(imagePrompt, /sofa seat\/front should face the TV\/media wall or declared focal point/);
assert.match(imagePrompt, /widescreen TV/);
assert.match(imagePrompt, /corrected verticals/);
assert.match(imagePrompt, /fake product labels/);
assert.match(imagePrompt, /Ritzy enhanced image styling layer/);
assert.match(imagePrompt, /Palette and material register:/);
// No catalogue framing may survive in the concept-first image prompt.
assert.equal(imagePrompt.includes("Catalogue-grounded concept references"), false);
assert.equal(imagePrompt.includes("Do not invent alternate anchor furniture"), false);

const strictPreservationImagePrompt = buildInitialConceptImagePrompt({
  generationPrompt: "Create a warm living room concept.",
  roomType: "living room",
  strictSourceRoomPreservation: true
});

assert.match(strictPreservationImagePrompt, /Strict source-room preservation layer/);
assert.match(strictPreservationImagePrompt, /Do not close, fill, remove, or invent wall openings/);
assert.match(strictPreservationImagePrompt, /keep that opening and sightline visible/);

console.log("initial concept prompt assembly tests passed");
