import assert from "node:assert/strict";

import { dryRunCatalogFirstRoomBundle } from "./catalog-first-dry-run";
import type { ProductBundleItem } from "./catalog-first-room-generation";

const item = ({
  roleId,
  productId,
  category,
  unitPriceAed,
  matchScore = 90
}: {
  roleId?: string;
  productId: string;
  category: string;
  unitPriceAed: number;
  matchScore?: number;
}): ProductBundleItem => ({
  roleId: roleId ?? "catalog_candidate",
  productId,
  category,
  name: productId,
  quantity: 1,
  unitPriceAed,
  tier: "premium",
  matchScore
});

const livingRoomCandidates = [
  item({ productId: "sofa-1", category: "sofas", unitPriceAed: 5000 }),
  item({ productId: "rug-1", category: "rugs", unitPriceAed: 1800 }),
  item({ productId: "coffee-table-1", category: "coffee_tables", unitPriceAed: 2200 }),
  item({ productId: "media-console-1", category: "media_units", unitPriceAed: 3200 }),
  item({ productId: "lamp-1", category: "lighting", unitPriceAed: 700 }),
  item({ productId: "cushion-1", category: "decor", unitPriceAed: 150 })
] as const;

{
  const result = dryRunCatalogFirstRoomBundle({
    roomType: "living_room",
    budgetTier: "premium",
    candidates: livingRoomCandidates
  });

  assert.equal(result.readiness, "ready");
  assert.deepEqual(result.missingRequiredRoleIds, []);
  assert.equal(result.assemblyOutput.bundle?.items.map((bundleItem) => bundleItem.roleId).includes("sofa"), true);
  assert.equal(result.assemblyInput.roomType, "living_room");
  assert.equal(result.assemblyOutput.bundle?.totalAed, 5000 + 1800 + 2200 + 3200 + 700 * 2 + 150 * 4);
  assert.equal(result.estimatedTotalAed, result.assemblyOutput.bundle?.totalAed);
}

{
  const result = dryRunCatalogFirstRoomBundle({
    roomType: "living_room",
    budgetTier: "budget",
    candidates: livingRoomCandidates.filter((candidate) => candidate.category !== "sofas")
  });

  assert.equal(result.readiness, "blocked");
  assert.deepEqual(result.missingRequiredRoleIds, ["sofa"]);
  assert.equal(result.assemblyOutput.bundle, null);
  assert.equal(result.warnings.includes("required role has no acceptable catalog candidate"), true);
}

{
  const result = dryRunCatalogFirstRoomBundle(
    {
      roomType: "bedroom",
      budgetTier: "premium",
      candidates: [
        item({ productId: "bed-1", category: "beds", unitPriceAed: 7000 }),
        item({ productId: "side-table-1", category: "side_tables", unitPriceAed: 1200 }),
        item({ productId: "lamp-1", category: "lighting", unitPriceAed: 800 }),
        item({ productId: "rug-1", category: "rugs", unitPriceAed: 1600 })
      ]
    },
    { budgetMaxAed: 9000 }
  );

  assert.equal(result.readiness, "ready");
  assert.equal(result.assemblyOutput.bundle?.totalAed, 7000 + 1200 * 2 + 800 * 2 + 1600);
  assert.equal(result.assemblyOutput.score?.budgetFit, 71);
}

{
  const result = dryRunCatalogFirstRoomBundle({
    roomType: "dining_room",
    budgetTier: "budget",
    candidates: [
      item({ productId: "table-1", category: "dining_tables", unitPriceAed: 4000 }),
      item({ productId: "chair-1", category: "chairs", unitPriceAed: 600 }),
      item({ productId: "pendant-1", category: "lighting", unitPriceAed: 900 }),
      item({ productId: "sideboard-1", category: "storage", unitPriceAed: 2500 })
    ],
    exclusions: {
      roleIds: ["dining_chairs"]
    }
  });

  assert.equal(result.readiness, "blocked");
  assert.deepEqual(result.missingRequiredRoleIds, ["dining_chairs"]);
  assert.equal(result.plan.rolePlans.find((rolePlan) => rolePlan.role.id === "dining_chairs")?.warnings.includes("role excluded by user"), true);
}

{
  const result = dryRunCatalogFirstRoomBundle({
    roomType: "home_office",
    budgetTier: "budget",
    candidates: [
      item({ productId: "desk-1", category: "desks", unitPriceAed: 2500 }),
      item({ productId: "chair-1", category: "office_chairs", unitPriceAed: 1600 })
    ]
  });

  assert.equal(result.readiness, "ready");
  assert.deepEqual(result.weakSupportingRoleIds, ["task_lighting", "storage_shelving"]);
  assert.equal(result.warnings.includes("supporting role has no acceptable catalog candidate"), true);
}

console.log("catalog-first dry-run tests passed");
