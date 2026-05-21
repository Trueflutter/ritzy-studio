import assert from "node:assert/strict";

import { canonicalRoomTypes, createRoomSchema, normalizeRoomType } from ".";

assert.deepEqual(canonicalRoomTypes, ["Living Room", "Dining Room", "Bedroom", "Home Office"]);

assert.equal(normalizeRoomType("lounge"), "Living Room");
assert.equal(normalizeRoomType("Parlour"), "Living Room");
assert.equal(normalizeRoomType("majlis"), "Living Room");
assert.equal(normalizeRoomType("dining area"), "Dining Room");
assert.equal(normalizeRoomType("primary bedroom"), "Bedroom");
assert.equal(normalizeRoomType("study"), "Home Office");

assert.equal(
  createRoomSchema.parse({
    projectId: "00000000-0000-4000-8000-000000000000",
    name: "Ground floor lounge",
    roomType: "parlor"
  }).roomType,
  "Living Room"
);

assert.throws(() => normalizeRoomType("kitchen"));

console.log("room type domain tests passed");
