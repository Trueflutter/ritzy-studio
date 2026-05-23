import assert from "node:assert/strict";

import {
  catalogFirstRolesForRoom,
  type ProductBundleItem,
  type ProductBundleTier,
  type RoomBundleRole
} from "./catalog-first-room-generation";
import { planCatalogFirstRoomBundle } from "./catalog-first-orchestration-planner";

function item(
  roleId: string,
  productId: string,
  category: string,
  unitPriceAed: number | null,
  matchScore: number | null,
  tier: ProductBundleTier = "premium"
): ProductBundleItem {
  return {
    roleId,
    productId,
    category,
    name: productId,
    quantity: 99,
    unitPriceAed,
    tier,
    matchScore
  };
}

function rolePlan(roomType: Parameters<typeof catalogFirstRolesForRoom>[0], roleId: string) {
  const plan = planCatalogFirstRoomBundle({
    roomType,
    budgetTier: "premium",
    candidates: candidatesForRoom(roomType)
  });
  const match = plan.rolePlans.find((candidatePlan) => candidatePlan.role.id === roleId);
  assert.ok(match, `Expected ${roomType} plan to include ${roleId}`);
  return match;
}

function candidatesForRoom(roomType: Parameters<typeof catalogFirstRolesForRoom>[0]) {
  if (roomType === "living_room") {
    return [
      item("wrong_role", "living-sofa", "sofas", 8000, 82),
      item("rug", "living-rug", "rugs", 2400, 75),
      item("coffee_table", "living-coffee-table", "coffee_tables", 1800, 72),
      item("tv_media_console", "living-console", "storage", 3200, 78),
      item("lighting", "living-lamp", "lighting", 900, 70),
      item("cushions", "living-cushions", "decor", 250, 65)
    ];
  }

  if (roomType === "dining_room") {
    return [
      item("dining_table", "dining-table", "dining_tables", 5000, 80),
      item("dining_chairs", "dining-chair", "chairs", 700, 78),
      item("lighting", "dining-light", "lighting", 1800, 76),
      item("sideboard_console", "dining-sideboard", "storage", 3200, 74)
    ];
  }

  if (roomType === "bedroom") {
    return [
      item("bed", "bedroom-bed", "beds", 9000, 86),
      item("bedside_tables", "bedside-table", "side_tables", 1200, 80),
      item("lighting", "bedroom-lamp", "lighting", 650, 70),
      item("rug_textile_layer", "bedroom-rug", "rugs", 1800, 68)
    ];
  }

  return [
    item("desk", "office-desk", "desks", 3400, 82),
    item("office_chair", "office-chair", "office_chairs", 2100, 84),
    item("task_lighting", "office-lamp", "lighting", 600, 70),
    item("storage_shelving", "office-storage", "storage", 2800, 72)
  ];
}

const livingPlan = planCatalogFirstRoomBundle({
  roomType: "Living Room",
  budgetTier: "premium",
  roomMeasurements: { wallLengthCm: 420, roomDepthCm: 500 },
  candidates: candidatesForRoom("living_room")
});
assert.equal(livingPlan.roomType, "living_room");
assert.deepEqual(
  livingPlan.requiredRoles.map((role) => role.id),
  ["sofa", "rug", "coffee_table"]
);
assert.deepEqual(
  livingPlan.supportingRoles.map((role) => role.id),
  ["tv_media_console", "lighting", "cushions"]
);
assert.deepEqual(
  livingPlan.rolePlans.map((plan) => plan.role.id),
  ["sofa", "rug", "coffee_table", "tv_media_console", "lighting", "cushions"]
);
assert.equal(rolePlan("living_room", "tv_media_console").selectedItem?.productId, "living-console");
assert.equal(rolePlan("living_room", "lighting").selectedItem?.quantity, 2);
assert.equal(livingPlan.warnings.includes("room measurements captured but not used for fit scoring"), true);

const diningPlan = planCatalogFirstRoomBundle({
  roomType: "dining_room",
  budgetTier: "premium",
  candidates: candidatesForRoom("dining_room")
});
assert.deepEqual(
  diningPlan.rolePlans.map((plan) => plan.role.id),
  ["dining_table", "dining_chairs", "lighting", "sideboard_console"]
);
assert.equal(diningPlan.quantityExpectations.dining_chairs, 6);
assert.equal(diningPlan.rolePlans.find((plan) => plan.role.id === "dining_chairs")?.selectedItem?.quantity, 6);
assert.equal(diningPlan.estimatedTotalAed, 5000 + 700 * 6 + 1800 + 3200);

const bedroomPlan = planCatalogFirstRoomBundle({
  roomType: "bedroom",
  budgetTier: "premium",
  candidates: candidatesForRoom("bedroom")
});
assert.deepEqual(
  bedroomPlan.rolePlans.map((plan) => plan.role.id),
  ["bed", "bedside_tables", "lighting", "rug_textile_layer"]
);
assert.equal(bedroomPlan.quantityExpectations.bedside_tables, 2);
assert.equal(bedroomPlan.rolePlans.find((plan) => plan.role.id === "lighting")?.selectedItem?.quantity, 2);

const officePlan = planCatalogFirstRoomBundle({
  roomType: "home_office",
  budgetTier: "premium",
  candidates: candidatesForRoom("home_office")
});
assert.deepEqual(
  officePlan.rolePlans.map((plan) => plan.role.id),
  ["desk", "office_chair", "task_lighting", "storage_shelving"]
);
assert.equal(officePlan.rolePlans.find((plan) => plan.role.id === "task_lighting")?.selectedItem?.productId, "office-lamp");
assert.equal(officePlan.rolePlans.find((plan) => plan.role.id === "storage_shelving")?.selectedItem?.productId, "office-storage");

const budgetPlan = planCatalogFirstRoomBundle({
  roomType: "living_room",
  budgetTier: "budget",
  roles: [catalogFirstRolesForRoom("living_room")[0]],
  candidates: [
    item("sofa", "expensive-sofa", "sofas", 9000, 99),
    item("sofa", "cheap-sofa", "sofas", 3000, 70)
  ]
});
assert.equal(budgetPlan.rolePlans[0].selectedItem?.productId, "cheap-sofa");

const premiumPlan = planCatalogFirstRoomBundle({
  roomType: "living_room",
  budgetTier: "premium",
  roles: [catalogFirstRolesForRoom("living_room")[0]],
  candidates: [
    item("sofa", "cheap-sofa", "sofas", 3000, 70),
    item("sofa", "best-sofa", "sofas", 8000, 95),
    item("sofa", "same-score-premium-sofa", "sofas", 9000, 95)
  ]
});
assert.equal(premiumPlan.rolePlans[0].selectedItem?.productId, "same-score-premium-sofa");

const tiedCandidatePlan = planCatalogFirstRoomBundle({
  roomType: "living_room",
  budgetTier: "budget",
  roles: [catalogFirstRolesForRoom("living_room")[0]],
  candidates: [
    item("sofa", "b-sofa", "sofas", 3000, 70),
    item("sofa", "a-sofa", "sofas", 3000, 70)
  ]
});
assert.equal(tiedCandidatePlan.rolePlans[0].selectedItem?.productId, "a-sofa");

const wrongCategoryPlan = planCatalogFirstRoomBundle({
  roomType: "living_room",
  budgetTier: "budget",
  roles: [catalogFirstRolesForRoom("living_room")[0]],
  candidates: [item("sofa", "wrong-rug", "rugs", 100, 100)]
});
assert.deepEqual(
  wrongCategoryPlan.missingRequiredRoles.map((role) => role.id),
  ["sofa"]
);
assert.equal(wrongCategoryPlan.rolePlans[0].selectedItem, null);

const excludedPlan = planCatalogFirstRoomBundle({
  roomType: "dining_room",
  budgetTier: "budget",
  candidates: candidatesForRoom("dining_room"),
  exclusions: {
    productIds: ["dining-table"],
    categories: ["lighting"],
    roleIds: ["sideboard_console"]
  }
});
assert.equal(excludedPlan.rolePlans.find((plan) => plan.role.id === "dining_table")?.status, "missing_required");
assert.equal(excludedPlan.rolePlans.find((plan) => plan.role.id === "lighting")?.status, "weak_supporting");
assert.equal(excludedPlan.rolePlans.find((plan) => plan.role.id === "sideboard_console")?.warnings[0], "role excluded by user");

const nullPricePlan = planCatalogFirstRoomBundle({
  roomType: "living_room",
  budgetTier: "budget",
  roles: [catalogFirstRolesForRoom("living_room")[0]],
  candidates: [
    item("sofa", "priced-sofa", "sofas", 3000, 70),
    item("sofa", "null-price-sofa", "sofas", null, 100)
  ]
});
assert.equal(nullPricePlan.rolePlans[0].selectedItem?.productId, "priced-sofa");

const selectedNullPricePlan = planCatalogFirstRoomBundle({
  roomType: "living_room",
  budgetTier: "budget",
  roles: [catalogFirstRolesForRoom("living_room")[0]],
  candidates: [item("sofa", "null-price-sofa", "sofas", null, 100)]
});
assert.equal(selectedNullPricePlan.estimatedTotalAed, null);

const badRole: RoomBundleRole = {
  ...catalogFirstRolesForRoom("living_room")[0],
  id: "sofa",
  quantity: 0,
  acceptedCategories: []
};
const customRolePlan = planCatalogFirstRoomBundle({
  roomType: "living_room",
  budgetTier: "budget",
  roles: [badRole, { ...catalogFirstRolesForRoom("bedroom")[0], id: "sofa" }],
  candidates: []
});
assert.deepEqual(customRolePlan.warnings, [
  "role sofa has no accepted categories",
  "role sofa has non-positive quantity",
  "duplicate role id: sofa",
  "role sofa belongs to bedroom, not living_room"
]);

assert.deepEqual(diningPlan.productMatchingRoleSpecs[1], {
  category: "chairs",
  label: "dining chairs",
  visualBrief: null,
  quantity: 6,
  priority: "required"
});

console.log("catalog-first orchestration planner tests passed");
