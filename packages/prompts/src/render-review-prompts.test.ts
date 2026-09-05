import assert from "node:assert/strict";

import {
  cameraReadJsonSchema,
  cameraReadPrompt,
  cameraReadResponseSchema,
  renderSpatialQaPrompt,
  viewConsistencyJsonSchema,
  viewConsistencyPrompt,
  viewConsistencyResponseSchema
} from ".";

// S4 step 2: the two vision reads that feed the planner and the view check,
// and the spatial QA prompt's restated verdict rules.

// The camera read answers, per photograph, whether it is the same room at
// all, where its camera stands, and whether it faces the focal wall; and for
// the hero whether the focal element is in frame and which key roles it hides.
assert.match(cameraReadPrompt.system, /same room/i);
assert.match(cameraReadPrompt.system, /behind the camera|not in frame|in frame/i);
const cameraSchema = cameraReadJsonSchema({ assetIds: ["a1", "a2"], roleKeys: ["0:sofa", "5:media_console"] });
const photoItem = (cameraSchema.properties.photos as unknown as { items: { properties: Record<string, { enum?: readonly string[] }> } }).items;
assert.deepEqual(photoItem.properties.assetId.enum, ["a1", "a2"]);
assert.deepEqual(photoItem.properties.sameRoom.enum, ["yes", "unsure", "no"]);
assert.deepEqual(photoItem.properties.cameraRelativeToHero.enum, ["same", "opposite", "left", "right", "unknown"]);
const heroProps = (cameraSchema.properties.hero as unknown as { properties: Record<string, { items?: { enum?: readonly string[] } }> }).properties;
assert.deepEqual(heroProps.hiddenRoleKeys.items?.enum, ["0:sofa", "5:media_console"]);
// No key roles at all still yields a valid strict schema (no empty enum).
const emptySchema = cameraReadJsonSchema({ assetIds: ["a1"], roleKeys: [] });
const emptyHero = (emptySchema.properties.hero as unknown as { properties: Record<string, { items?: { enum?: readonly string[]; type?: string } }> }).properties;
assert.equal(emptyHero.hiddenRoleKeys.items?.enum, undefined);
assert.equal(emptyHero.hiddenRoleKeys.items?.type, "string");
const parsedRead = cameraReadResponseSchema.parse({
  hero: { showsFocalElement: false, hiddenRoleKeys: ["5:media_console"] },
  photos: [{ assetId: "a2", sameRoom: "yes", cameraRelativeToHero: "opposite", showsFocalWall: true }]
});
assert.equal(parsedRead.photos[0].showsFocalWall, true);
assert.throws(() => cameraReadResponseSchema.parse({ hero: { showsFocalElement: "maybe", hiddenRoleKeys: [] }, photos: [] }));

// The view consistency check compares architecture (against the anchored
// photograph when there is one), the camera position, shared objects, the
// expected roles, and inventions.
assert.match(viewConsistencyPrompt.system, /anchored photograph|photograph of the real room/i);
assert.match(viewConsistencyPrompt.system, /expected/i);
assert.match(viewConsistencyPrompt.system, /invent/i);
assert.deepEqual(
  [...(viewConsistencyJsonSchema.properties.cameraMatchesAnchor as unknown as { enum: readonly string[] }).enum],
  ["yes", "no", "not_applicable"]
);
const parsedCheck = viewConsistencyResponseSchema.parse({
  architectureConsistent: true,
  cameraMatchesAnchor: "not_applicable",
  sharedObjectsConsistent: false,
  expectedShown: ["the TV and media wall"],
  expectedMissing: [],
  invented: ["a second armchair"],
  verdict: "inconsistent",
  issues: ["The sofa is a different colour from the hero."]
});
assert.equal(parsedCheck.invented.length, 1);

// Spatial QA: the version moved, hard violations are named as regenerate, and
// the reviewer is told the camera can have the focal wall behind it.
assert.equal(renderSpatialQaPrompt.version, "2026-09-05.1");
assert.match(renderSpatialQaPrompt.system, /NOT IN FRAME/);
assert.match(renderSpatialQaPrompt.system, /regenerate, never warn|never warn/i);

console.log("render review prompt tests passed");
