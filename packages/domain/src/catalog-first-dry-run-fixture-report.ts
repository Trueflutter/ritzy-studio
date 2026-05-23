import {
  dryRunCatalogFirstRoomBundle,
  type CatalogFirstDryRunReadiness
} from "./catalog-first-dry-run";
import {
  catalogFirstDryRunFixtureScenarios,
  type CatalogFirstDryRunFixtureScenario
} from "./catalog-first-dry-run-fixtures";
import type { CatalogFirstRoomType } from "./catalog-first-room-generation";

export type CatalogFirstDryRunFixtureReportRow = {
  scenarioId: string;
  roomType: CatalogFirstRoomType;
  readiness: CatalogFirstDryRunReadiness;
  estimatedTotalAed: number | null;
  missingRequiredRoleIds: readonly string[];
  weakSupportingRoleIds: readonly string[];
};

export type CatalogFirstDryRunFixtureReport = {
  scenarioCount: number;
  readyCount: number;
  blockedCount: number;
  rows: readonly CatalogFirstDryRunFixtureReportRow[];
};

export function catalogFirstDryRunFixtureReport(
  scenarios: readonly CatalogFirstDryRunFixtureScenario[] = catalogFirstDryRunFixtureScenarios()
): CatalogFirstDryRunFixtureReport {
  const rows = scenarios.map((scenario) => {
    const result = dryRunCatalogFirstRoomBundle(scenario.input, {
      budgetMaxAed: scenario.budgetMaxAed
    });

    return {
      scenarioId: scenario.id,
      roomType: result.plan.roomType,
      readiness: result.readiness,
      estimatedTotalAed: result.estimatedTotalAed,
      missingRequiredRoleIds: result.missingRequiredRoleIds,
      weakSupportingRoleIds: result.weakSupportingRoleIds
    };
  });
  const readyCount = rows.filter((row) => row.readiness === "ready").length;

  return {
    scenarioCount: rows.length,
    readyCount,
    blockedCount: rows.length - readyCount,
    rows
  };
}
