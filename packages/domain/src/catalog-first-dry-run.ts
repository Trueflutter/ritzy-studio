import {
  assembleCatalogFirstPlanBundle,
  catalogFirstPlanToBundleAssemblyInput
} from "./catalog-first-plan-assembly";
import type { BundleAssemblyInput, BundleAssemblyOutput } from "./catalog-first-room-generation";
import {
  planCatalogFirstRoomBundle,
  type CatalogFirstOrchestrationPlan,
  type CatalogFirstOrchestrationPlanInput
} from "./catalog-first-orchestration-planner";

export type CatalogFirstDryRunReadiness = "ready" | "blocked";

export type CatalogFirstDryRunOptions = {
  budgetMaxAed?: number | null;
};

export type CatalogFirstDryRunResult = {
  plan: CatalogFirstOrchestrationPlan;
  assemblyInput: BundleAssemblyInput;
  assemblyOutput: BundleAssemblyOutput;
  readiness: CatalogFirstDryRunReadiness;
  missingRequiredRoleIds: readonly string[];
  weakSupportingRoleIds: readonly string[];
  estimatedTotalAed: number | null;
  warnings: readonly string[];
};

export function dryRunCatalogFirstRoomBundle(
  input: CatalogFirstOrchestrationPlanInput,
  options: CatalogFirstDryRunOptions = {}
): CatalogFirstDryRunResult {
  const plan = planCatalogFirstRoomBundle(input);
  const assemblyInput = catalogFirstPlanToBundleAssemblyInput(plan, options.budgetMaxAed ?? null);
  const assemblyOutput = assembleCatalogFirstPlanBundle(plan, options.budgetMaxAed ?? null);
  const missingRequiredRoleIds = assemblyOutput.missingRequiredRoleIds;
  const weakSupportingRoleIds = plan.weakSupportingRoles.map((role) => role.id);
  const warnings = [
    ...plan.warnings,
    ...plan.rolePlans.flatMap((rolePlan) => rolePlan.warnings),
    ...((assemblyOutput.score?.notes ?? []).filter((note) => note.length > 0))
  ];

  return {
    plan,
    assemblyInput,
    assemblyOutput,
    readiness: missingRequiredRoleIds.length === 0 ? "ready" : "blocked",
    missingRequiredRoleIds,
    weakSupportingRoleIds,
    estimatedTotalAed: plan.estimatedTotalAed,
    warnings
  };
}
