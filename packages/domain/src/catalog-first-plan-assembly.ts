import {
  assembleCatalogFirstBundle,
  type BundleAssemblyInput,
  type BundleAssemblyOutput
} from "./catalog-first-room-generation";
import type { CatalogFirstOrchestrationPlan } from "./catalog-first-orchestration-planner";

export function catalogFirstPlanToBundleAssemblyInput(
  plan: CatalogFirstOrchestrationPlan,
  budgetMaxAed?: number | null
): BundleAssemblyInput {
  return {
    roomType: plan.roomType,
    tier: plan.budgetTier,
    roles: plan.rolePlans.map((rolePlan) => rolePlan.role),
    budgetMaxAed: budgetMaxAed ?? null,
    candidateItemsByRoleId: Object.fromEntries(
      plan.rolePlans.flatMap((rolePlan) =>
        rolePlan.selectedItem ? [[rolePlan.role.id, [rolePlan.selectedItem]]] : []
      )
    )
  };
}

export function assembleCatalogFirstPlanBundle(
  plan: CatalogFirstOrchestrationPlan,
  budgetMaxAed?: number | null
): BundleAssemblyOutput {
  return assembleCatalogFirstBundle(catalogFirstPlanToBundleAssemblyInput(plan, budgetMaxAed));
}
