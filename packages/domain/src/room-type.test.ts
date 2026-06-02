import assert from "node:assert/strict";

import {
  canonicalRoomTypes,
  canonicalRoomTypeSchema,
  createRoomSchema,
  isCombinedLivingDining,
  normalizeRoomType,
  roomCreationRoomTypes
} from ".";

assert.deepEqual(canonicalRoomTypes, [
  "Living Room",
  "Dining Room",
  "Bedroom",
  "Home Office",
  "Living & Dining"
]);
assert.deepEqual(roomCreationRoomTypes, [
  "Living Room",
  "Dining Room",
  "Bedroom",
  "Home Office",
  "Living & Dining"
]);
assert.equal(roomCreationRoomTypes.includes("Living & Dining"), true);
assert.equal(canonicalRoomTypeSchema.parse("Living & Dining"), "Living & Dining");

const combinedLivingDiningAliases = [
  "Living & Dining",
  "living and dining",
  "living/dining",
  "Living / Dining",
  "living-dining",
  "living dining",
  "living dining hall",
  "open plan living dining",
  "open-plan living and dining"
] as const;

for (const alias of combinedLivingDiningAliases) {
  assert.equal(normalizeRoomType(alias), "Living & Dining");
  assert.equal(isCombinedLivingDining(alias), true);
}

assert.equal(normalizeRoomType("lounge"), "Living Room");
assert.equal(normalizeRoomType("Parlour"), "Living Room");
assert.equal(normalizeRoomType("majlis"), "Living Room");
assert.equal(normalizeRoomType("Living Room"), "Living Room");
assert.equal(normalizeRoomType("dining area"), "Dining Room");
assert.equal(normalizeRoomType("Dining Room"), "Dining Room");
assert.equal(normalizeRoomType("primary bedroom"), "Bedroom");
assert.equal(normalizeRoomType("Bedroom"), "Bedroom");
assert.equal(normalizeRoomType("study"), "Home Office");
assert.equal(normalizeRoomType("Home Office"), "Home Office");

for (const singleRoomType of ["Living Room", "Dining Room", "Bedroom", "Home Office"]) {
  assert.equal(isCombinedLivingDining(singleRoomType), false);
}

assert.equal(
  createRoomSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000000",
    name: "Ground floor lounge",
    roomType: "parlor"
  }).roomType,
  "Living Room"
);
assert.equal(
  createRoomSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000000",
    name: "Open hall",
    roomType: "Living & Dining"
  }).roomType,
  "Living & Dining"
);

assert.throws(() => normalizeRoomType("kitchen"));

console.log("room type domain tests passed");
