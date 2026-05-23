import assert from "node:assert/strict";

import { dryRunCatalogFirstRoomBundle } from "./catalog-first-dry-run";
import { catalogFirstDryRunFixtureReport } from "./catalog-first-dry-run-fixture-report";
import {
  catalogFirstDryRunEdgeCaseFixtureScenarios,
  catalogFirstDryRunFixtureByRoom,
  catalogFirstDryRunFixtureScenarios
} from "./catalog-first-dry-run-fixtures";
import type { CatalogFirstRoomType } from "./catalog-first-room-generation";

const canonicalRooms: readonly CatalogFirstRoomType[] = ["living_room", "dining_room", "bedroom", "home_office"];
const scenarios = catalogFirstDryRunFixtureScenarios();

assert.deepEqual(
  scenarios.map((scenario) => scenario.input.roomType),
  canonicalRooms
);

for (const roomType of canonicalRooms) {
  const scenario = catalogFirstDryRunFixtureByRoom(roomType);

  assert.equal(scenario?.input.roomType, roomType);

  const result = dryRunCatalogFirstRoomBundle(scenario.input, {
    budgetMaxAed: scenario.budgetMaxAed
  });

  assert.equal(result.readiness, "ready");
  assert.deepEqual(result.missingRequiredRoleIds, []);
  assert.equal(result.assemblyOutput.bundle?.items.length, result.plan.rolePlans.length);
}

assert.equal(catalogFirstDryRunFixtureByRoom("living room")?.input.roomType, "living_room");

{
  const scenario = catalogFirstDryRunFixtureByRoom("dining_room")!;
  const result = dryRunCatalogFirstRoomBundle(scenario.input, {
    budgetMaxAed: scenario.budgetMaxAed
  });
  const chairs = result.assemblyOutput.bundle?.items.find((item) => item.roleId === "dining_chairs");

  assert.equal(chairs?.quantity, 6);
  assert.equal(result.assemblyOutput.bundle?.totalAed, 4300 + 650 * 6 + 1200 + 3100);
}

{
  const scenario = catalogFirstDryRunFixtureByRoom("bedroom")!;
  const result = dryRunCatalogFirstRoomBundle(scenario.input, {
    budgetMaxAed: scenario.budgetMaxAed
  });
  const bedsideTables = result.assemblyOutput.bundle?.items.find((item) => item.roleId === "bedside_tables");
  const lighting = result.assemblyOutput.bundle?.items.find((item) => item.roleId === "lighting");

  assert.equal(bedsideTables?.quantity, 2);
  assert.equal(lighting?.quantity, 2);
  assert.equal(result.assemblyOutput.bundle?.totalAed, 7200 + 1200 * 2 + 800 * 2 + 1900);
}

assert.throws(() => catalogFirstDryRunFixtureByRoom("bathroom"), /Unsupported catalog-first room type/);

{
  const edgeCaseReport = catalogFirstDryRunFixtureReport(catalogFirstDryRunEdgeCaseFixtureScenarios());

  assert.equal(edgeCaseReport.scenarioCount, 3);
  assert.equal(edgeCaseReport.readyCount, 1);
  assert.equal(edgeCaseReport.blockedCount, 2);
  assert.deepEqual(edgeCaseReport.rows[0]?.missingRequiredRoleIds, ["sofa"]);
  assert.deepEqual(edgeCaseReport.rows[1]?.missingRequiredRoleIds, ["dining_chairs"]);
  assert.deepEqual(edgeCaseReport.rows[2]?.weakSupportingRoleIds, ["task_lighting", "storage_shelving"]);
}

console.log("catalog-first dry-run fixture tests passed");
