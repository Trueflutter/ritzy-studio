import assert from "node:assert/strict";

import { normalizeCatalogFirstRoomType } from "./room-type-normalize";

assert.equal(normalizeCatalogFirstRoomType("living_room"), "living_room");
assert.equal(normalizeCatalogFirstRoomType("Living Room"), "living_room");
assert.equal(normalizeCatalogFirstRoomType("living room"), "living_room");
assert.equal(normalizeCatalogFirstRoomType("  living-room  "), "living_room");
assert.equal(normalizeCatalogFirstRoomType("lounge"), "living_room");
assert.equal(normalizeCatalogFirstRoomType("family room"), "living_room");
assert.equal(normalizeCatalogFirstRoomType("Living & Dining"), "living_dining");
assert.equal(normalizeCatalogFirstRoomType("living and dining"), "living_dining");
assert.equal(normalizeCatalogFirstRoomType("Living / Dining"), "living_dining");
assert.equal(normalizeCatalogFirstRoomType("living-dining"), "living_dining");
assert.equal(normalizeCatalogFirstRoomType("living dining hall"), "living_dining");
assert.equal(normalizeCatalogFirstRoomType("dining_room"), "dining_room");
assert.equal(normalizeCatalogFirstRoomType("Dining Room"), "dining_room");
assert.equal(normalizeCatalogFirstRoomType("dining area"), "dining_room");
assert.equal(normalizeCatalogFirstRoomType("bedroom"), "bedroom");
assert.equal(normalizeCatalogFirstRoomType("Bedroom"), "bedroom");
assert.equal(normalizeCatalogFirstRoomType("primary bedroom"), "bedroom");
assert.equal(normalizeCatalogFirstRoomType("home_office"), "home_office");
assert.equal(normalizeCatalogFirstRoomType("Home Office"), "home_office");
assert.equal(normalizeCatalogFirstRoomType("office"), "home_office");
assert.equal(normalizeCatalogFirstRoomType("study"), "home_office");
assert.equal(normalizeCatalogFirstRoomType("workspace"), "home_office");
assert.throws(() => normalizeCatalogFirstRoomType("bathroom"), /Unsupported catalog-first room type/);

console.log("room-type-normalize tests passed");
