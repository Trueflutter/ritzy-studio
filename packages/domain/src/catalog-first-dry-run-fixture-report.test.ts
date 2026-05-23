import assert from "node:assert/strict";

import { catalogFirstDryRunFixtureReport } from "./catalog-first-dry-run-fixture-report";
import {
  catalogFirstDryRunFixtureScenarios,
  type CatalogFirstDryRunFixtureScenario
} from "./catalog-first-dry-run-fixtures";
import type { ProductBundleItem } from "./catalog-first-room-generation";

const report = catalogFirstDryRunFixtureReport();

assert.equal(report.scenarioCount, 4);
assert.equal(report.readyCount, 4);
assert.equal(report.blockedCount, 0);
assert.deepEqual(
  report.rows.map((row) => row.roomType),
  ["living_room", "dining_room", "bedroom", "home_office"]
);
assert.deepEqual(
  report.rows.map((row) => row.readiness),
  ["ready", "ready", "ready", "ready"]
);

{
  const diningRow = report.rows.find((row) => row.roomType === "dining_room");
  const bedroomRow = report.rows.find((row) => row.roomType === "bedroom");

  assert.equal(diningRow?.estimatedTotalAed, 4300 + 650 * 6 + 1200 + 3100);
  assert.equal(bedroomRow?.estimatedTotalAed, 7200 + 1200 * 2 + 800 * 2 + 1900);
}

{
  const livingRoomFixture = catalogFirstDryRunFixtureScenarios()[0];
  const blockedFixture: CatalogFirstDryRunFixtureScenario = {
    ...livingRoomFixture,
    id: "living-room-missing-sofa",
    input: {
      ...livingRoomFixture.input,
      candidates: livingRoomFixture.input.candidates.filter((candidate) => candidate.category !== "sofas")
    }
  };
  const blockedReport = catalogFirstDryRunFixtureReport([blockedFixture]);

  assert.equal(blockedReport.scenarioCount, 1);
  assert.equal(blockedReport.readyCount, 0);
  assert.equal(blockedReport.blockedCount, 1);
  assert.deepEqual(blockedReport.rows[0]?.missingRequiredRoleIds, ["sofa"]);
}

{
  const officeFixture = catalogFirstDryRunFixtureScenarios().find((scenario) => scenario.input.roomType === "home_office")!;
  const weakSupportingFixture: CatalogFirstDryRunFixtureScenario = {
    ...officeFixture,
    id: "home-office-missing-supporting",
    input: {
      ...officeFixture.input,
      candidates: officeFixture.input.candidates.filter(
        (candidate: ProductBundleItem) => candidate.category !== "lighting" && candidate.category !== "shelving"
      )
    }
  };
  const weakSupportingReport = catalogFirstDryRunFixtureReport([weakSupportingFixture]);

  assert.equal(weakSupportingReport.readyCount, 1);
  assert.deepEqual(weakSupportingReport.rows[0]?.weakSupportingRoleIds, ["task_lighting", "storage_shelving"]);
}

console.log("catalog-first dry-run fixture report tests passed");
