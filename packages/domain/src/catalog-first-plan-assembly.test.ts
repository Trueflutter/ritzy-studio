import assert from "node:assert/strict";

import { assembleCatalogFirstBundle, catalogFirstRolesForRoom, type ProductBundleItem } from "./catalog-first-room-generation";
import { assembleCatalogFirstPlanBundle, catalogFirstPlanToBundleAssemblyInput } from "./catalog-first-plan-assembly";
import { planCatalogFirstRoomBundle } from "./catalog-first-orchestration-planner";

function item(roleId: string, productId: string, category: string, price: number | null, matchScore = 80): ProductBundleItem {
  return {
    roleId,
    productId,
    category,
    name: productId,
    quantity: 99,
    unitPriceAed: price,
    tier: "premium",
    matchScore
  };
}

function livingRole(roleId: string) {
  const role = catalogFirstRolesForRoom("living_room").find((candidate) => candidate.id === roleId);
  assert.ok(role, `Expected living room role ${roleId}`);
  return role;
}

const interleavedRoles = [
  livingRole("coffee_table"),
  livingRole("sofa"),
  livingRole("lighting"),
  livingRole("rug")
];
const interleavedPlan = planCatalogFirstRoomBundle({
  roomType: "living_room",
  budgetTier: "premium",
  roles: interleavedRoles,
  candidates: [
    item("unused", "rug-a", "rugs", 2000, 70),
    item("unused", "sofa-a", "sofas", 8000, 90),
    item("unused", "lamp-a", "lighting", 500, 65),
    item("unused", "coffee-a", "coffee_tables", 1500, 80)
  ]
});
const interleavedAssemblyInput = catalogFirstPlanToBundleAssemblyInput(interleavedPlan, 11500);

assert.equal(interleavedAssemblyInput.roomType, "living_room");
assert.equal(interleavedAssemblyInput.tier, "premium");
assert.equal(interleavedAssemblyInput.budgetMaxAed, 11500);
assert.deepEqual(
  interleavedAssemblyInput.roles.map((role) => role.id),
  ["coffee_table", "sofa", "lighting", "rug"]
);
assert.deepEqual(Object.keys(interleavedAssemblyInput.candidateItemsByRoleId), [
  "coffee_table",
  "sofa",
  "lighting",
  "rug"
]);
assert.equal(interleavedAssemblyInput.candidateItemsByRoleId.sofa?.[0]?.productId, "sofa-a");
assert.equal(interleavedAssemblyInput.candidateItemsByRoleId.lighting?.[0]?.quantity, 2);

const interleavedBundle = assembleCatalogFirstBundle(interleavedAssemblyInput);
assert.deepEqual(
  interleavedBundle.bundle?.items.map((bundleItem) => bundleItem.roleId),
  ["coffee_table", "sofa", "lighting", "rug"]
);
assert.equal(interleavedBundle.bundle?.items.find((bundleItem) => bundleItem.roleId === "lighting")?.quantity, 2);
assert.equal(interleavedBundle.bundle?.totalAed, 1500 + 8000 + 500 * 2 + 2000);
assert.equal(interleavedBundle.score?.budgetFit, 92);

const convenienceBundle = assembleCatalogFirstPlanBundle(interleavedPlan, 11500);
assert.deepEqual(convenienceBundle, interleavedBundle);

const missingRequiredPlan = planCatalogFirstRoomBundle({
  roomType: "living_room",
  budgetTier: "budget",
  roles: [livingRole("sofa"), livingRole("rug"), livingRole("coffee_table")],
  candidates: [
    item("sofa", "wrong-rug-for-sofa", "rugs", 300, 100),
    item("rug", "actual-rug", "rugs", 2000, 75),
    item("coffee_table", "actual-coffee", "coffee_tables", 1200, 80)
  ]
});
const missingAssemblyInput = catalogFirstPlanToBundleAssemblyInput(missingRequiredPlan);

assert.equal(missingAssemblyInput.candidateItemsByRoleId.sofa, undefined);
assert.deepEqual(Object.keys(missingAssemblyInput.candidateItemsByRoleId), ["rug", "coffee_table"]);

const missingBundle = assembleCatalogFirstPlanBundle(missingRequiredPlan);
assert.deepEqual(missingBundle.missingRequiredRoleIds, ["sofa"]);
assert.equal(missingBundle.bundle, null);
assert.equal(missingBundle.score, null);

const defaultBudgetInput = catalogFirstPlanToBundleAssemblyInput(interleavedPlan);
assert.equal(defaultBudgetInput.budgetMaxAed, null);

console.log("catalog-first plan assembly tests passed");
