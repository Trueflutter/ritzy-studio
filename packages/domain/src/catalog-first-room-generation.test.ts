import assert from "node:assert/strict";

import {
  assembleCatalogFirstBundle,
  catalogFirstRoomBundleBlueprints,
  catalogFirstRolesForRoom,
  normalizeCatalogFirstRoomType,
  type CatalogFirstRoomType,
  type ProductBundleItem,
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

assert.equal(normalizeCatalogFirstRoomType("living_room"), "living_room");
assert.equal(normalizeCatalogFirstRoomType("Living Room"), "living_room");
assert.equal(normalizeCatalogFirstRoomType("living room"), "living_room");
assert.equal(normalizeCatalogFirstRoomType("  living-room  "), "living_room");
assert.equal(normalizeCatalogFirstRoomType("lounge"), "living_room");
assert.equal(normalizeCatalogFirstRoomType("family room"), "living_room");
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

function item(roleId: string, price: number | null, quantity = 99, tier: "budget" | "premium" = "premium"): ProductBundleItem {
  return {
    roleId,
    productId: `${roleId}-product`,
    category: roleId,
    name: `${roleId} product`,
    quantity,
    unitPriceAed: price,
    tier,
    matchScore: 80
  };
}

const diningRoles = catalogFirstRolesForRoom("dining_room");
const completeDiningBundle = assembleCatalogFirstBundle({
  roomType: "dining_room",
  tier: "premium",
  roles: diningRoles,
  budgetMaxAed: 12000,
  candidateItemsByRoleId: {
    dining_table: [item("dining_table", 5000, 1, "budget")],
    dining_chairs: [item("dining_chairs", 700, 1, "budget")],
    lighting: [item("lighting", 1800)],
    sideboard_console: [item("sideboard_console", 3200)]
  }
});
assert.equal(completeDiningBundle.tier, "premium");
assert.equal(completeDiningBundle.bundle?.tier, "premium");
assert.deepEqual(completeDiningBundle.missingRequiredRoleIds, []);
assert.equal(completeDiningBundle.bundle?.items.find((bundleItem) => bundleItem.roleId === "dining_chairs")?.quantity, 6);
assert.equal(completeDiningBundle.bundle?.totalAed, 5000 + 700 * 6 + 1800 + 3200);
assert.equal(completeDiningBundle.score?.roleCoverage, 100);
assert.equal(completeDiningBundle.score?.budgetFit, 85);
assert.deepEqual(completeDiningBundle.score?.notes, ["visual cohesion not scored in domain assembly"]);

const livingBundle = assembleCatalogFirstBundle({
  roomType: "living_room",
  tier: "budget",
  roles: catalogFirstRolesForRoom("living_room"),
  budgetMaxAed: 25000,
  candidateItemsByRoleId: {
    sofa: [item("sofa", 8000)],
    rug: [item("rug", 2400)],
    coffee_table: [item("coffee_table", 1800)],
    tv_media_console: [item("tv_media_console", 3200)],
    lighting: [item("lighting", 900, 1)],
    cushions: [item("cushions", 250, 1)]
  }
});
assert.equal(livingBundle.bundle?.items.find((bundleItem) => bundleItem.roleId === "lighting")?.quantity, 2);
assert.equal(livingBundle.bundle?.items.find((bundleItem) => bundleItem.roleId === "cushions")?.quantity, 4);
assert.equal(livingBundle.bundle?.totalAed, 8000 + 2400 + 1800 + 3200 + 900 * 2 + 250 * 4);

const optionalMissingBundle = assembleCatalogFirstBundle({
  roomType: "living_room",
  tier: "premium",
  roles: catalogFirstRolesForRoom("living_room"),
  candidateItemsByRoleId: {
    sofa: [item("sofa", 8000)],
    rug: [item("rug", 2400)],
    coffee_table: [item("coffee_table", 1800)]
  }
});
assert.deepEqual(optionalMissingBundle.missingRequiredRoleIds, []);
assert.deepEqual(
  optionalMissingBundle.bundle?.items.map((bundleItem) => bundleItem.roleId),
  ["sofa", "rug", "coffee_table"]
);

const bedroomBundle = assembleCatalogFirstBundle({
  roomType: "bedroom",
  tier: "premium",
  roles: catalogFirstRolesForRoom("bedroom"),
  candidateItemsByRoleId: {
    bed: [item("bed", 9000)],
    bedside_tables: [item("bedside_tables", 1200)],
    lighting: [item("lighting", 650)],
    rug_textile_layer: [item("rug_textile_layer", 1800)]
  }
});
assert.equal(bedroomBundle.bundle?.items.find((bundleItem) => bundleItem.roleId === "bedside_tables")?.quantity, 2);
assert.equal(bedroomBundle.bundle?.items.find((bundleItem) => bundleItem.roleId === "lighting")?.quantity, 2);
assert.equal(bedroomBundle.bundle?.totalAed, 9000 + 1200 * 2 + 650 * 2 + 1800);

const missingRequiredBundle = assembleCatalogFirstBundle({
  roomType: "home_office",
  tier: "budget",
  roles: catalogFirstRolesForRoom("home_office"),
  candidateItemsByRoleId: {
    desk: [item("desk", 2400)],
    task_lighting: [item("task_lighting", 600)]
  }
});
assert.deepEqual(missingRequiredBundle.missingRequiredRoleIds, ["office_chair"]);
assert.equal(missingRequiredBundle.bundle, null);
assert.equal(missingRequiredBundle.score, null);

const callerOrderBundle = assembleCatalogFirstBundle({
  roomType: "living_room",
  tier: "premium",
  roles: [roleById("living_room", "sofa"), roleById("living_room", "rug"), roleById("living_room", "coffee_table")],
  candidateItemsByRoleId: {
    sofa: [
      { ...item("sofa", 9000), productId: "first-sofa", name: "First sofa", matchScore: 20 },
      { ...item("sofa", 1000), productId: "second-sofa", name: "Second sofa", matchScore: 100 }
    ],
    rug: [item("rug", 2000)],
    coffee_table: [item("coffee_table", 1200)]
  }
});
assert.equal(callerOrderBundle.bundle?.items[0].productId, "first-sofa");

const unknownTotalBundle = assembleCatalogFirstBundle({
  roomType: "living_room",
  tier: "budget",
  roles: [roleById("living_room", "sofa"), roleById("living_room", "rug"), roleById("living_room", "coffee_table")],
  budgetMaxAed: 10000,
  candidateItemsByRoleId: {
    sofa: [item("sofa", null)],
    rug: [item("rug", 2000)],
    coffee_table: [item("coffee_table", 1200)]
  }
});
assert.equal(unknownTotalBundle.bundle?.totalAed, null);
assert.equal(unknownTotalBundle.score?.budgetFit, 0);

const zeroBudgetBundle = assembleCatalogFirstBundle({
  roomType: "living_room",
  tier: "budget",
  roles: [roleById("living_room", "sofa"), roleById("living_room", "rug"), roleById("living_room", "coffee_table")],
  budgetMaxAed: 0,
  candidateItemsByRoleId: {
    sofa: [item("sofa", 8000)],
    rug: [item("rug", 2000)],
    coffee_table: [item("coffee_table", 1200)]
  }
});
assert.equal(zeroBudgetBundle.score?.budgetFit, 0);

console.log("catalog-first room generation tests passed");
