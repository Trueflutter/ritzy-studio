import assert from "node:assert/strict";

import {
  catalogFirstRoomBundleBlueprints,
  catalogFirstRolesForRoom,
  type CatalogFirstRoomType,
  type RoomBundleRole
} from "./catalog-first-room-generation";

function roleIds(roomType: CatalogFirstRoomType) {
  return catalogFirstRolesForRoom(roomType).map((role) => role.id);
}

function roleById(roomType: CatalogFirstRoomType, id: string): RoomBundleRole {
  const match = catalogFirstRolesForRoom(roomType).find((role) => role.id === id);
  assert.ok(match, `Expected ${roomType} to include ${id}`);
  return match;
}

assert.deepEqual(roleIds("living_room"), [
  "sofa",
  "rug",
  "coffee_table",
  "tv_media_console",
  "lighting",
  "cushions"
]);
assert.equal(roleById("living_room", "sofa").category, "sofas");
assert.equal(roleById("living_room", "rug").category, "rugs");
assert.equal(roleById("living_room", "coffee_table").category, "coffee_tables");
assert.equal(roleById("living_room", "tv_media_console").category, "storage");
assert.equal(roleById("living_room", "lighting").category, "lighting");

assert.deepEqual(roleIds("dining_room"), ["dining_table", "dining_chairs", "lighting", "sideboard_console"]);
assert.equal(roleById("dining_room", "dining_table").category, "dining_tables");
assert.equal(roleById("dining_room", "dining_chairs").category, "chairs");
assert.equal(roleById("dining_room", "lighting").category, "lighting");
assert.equal(roleById("dining_room", "sideboard_console").category, "storage");
assert.equal(roleById("dining_room", "sideboard_console").includeWhen, "catalog_supports");
assert.equal(roleById("dining_room", "sideboard_console").required, false);

assert.deepEqual(roleIds("bedroom"), ["bed", "bedside_tables", "lighting", "rug_textile_layer"]);
assert.equal(roleById("bedroom", "bed").category, "beds");
assert.equal(roleById("bedroom", "bedside_tables").category, "side_tables");
assert.equal(roleById("bedroom", "lighting").category, "lighting");
assert.equal(roleById("bedroom", "rug_textile_layer").category, "rugs");

assert.deepEqual(roleIds("home_office"), ["desk", "office_chair", "task_lighting", "storage_shelving"]);
assert.equal(roleById("home_office", "desk").category, "desks");
assert.equal(roleById("home_office", "office_chair").category, "office_chairs");
assert.equal(roleById("home_office", "task_lighting").category, "lighting");
assert.equal(roleById("home_office", "storage_shelving").category, "storage");

assert.equal(roleById("dining_room", "dining_chairs").quantity, 6);
assert.equal(roleById("bedroom", "bedside_tables").quantity, 2);
assert.equal(roleById("living_room", "lighting").quantity, 2);
assert.equal(roleById("bedroom", "lighting").quantity, 2);
assert.equal(roleById("living_room", "cushions").quantity, 4);

for (const [roomType, roles] of Object.entries(catalogFirstRoomBundleBlueprints)) {
  const ids = roles.map((role) => role.id);
  assert.equal(new Set(ids).size, ids.length, `${roomType} should not repeat role ids`);

  for (const role of roles) {
    assert.equal(role.roomType, roomType);
    assert.equal(role.quantity >= 1, true, `${role.id} should have a positive quantity`);
    assert.ok(
      role.acceptedCategories.includes(role.category),
      `${role.id} acceptedCategories should include its primary category`
    );
  }
}

console.log("catalog-first room generation tests passed");
