import type { ProductMatchRolePoolDiversity } from "./product-matching-pool-diversity";
import type { ProductMatchRolePoolQuality } from "./product-matching-pool-quality";

export type ProductMatchPoolQaRollup = {
  totalRoleCount: number;
  requiredRoleCount: number;
  emptyPoolCount: number;
  thinPoolCount: number;
  weakPoolCount: number;
  narrowPoolCount: number;
  scatteredPoolCount: number;
  requiredEmptyPoolCount: number;
  requiredWeakPoolCount: number;
  requiredScatteredPoolCount: number;
  manualReviewSuggested: boolean;
};

export function summarizePoolQaRollup({
  rolePoolQuality,
  rolePoolDiversity
}: {
  rolePoolQuality: ProductMatchRolePoolQuality[];
  rolePoolDiversity: ProductMatchRolePoolDiversity[];
}): ProductMatchPoolQaRollup {
  const diversityByRoleKey = new Map(rolePoolDiversity.map((summary) => [summary.roleKey, summary]));
  let emptyPoolCount = 0;
  let thinPoolCount = 0;
  let weakPoolCount = 0;
  let narrowPoolCount = 0;
  let scatteredPoolCount = 0;
  let requiredEmptyPoolCount = 0;
  let requiredWeakPoolCount = 0;
  let requiredScatteredPoolCount = 0;

  for (const quality of rolePoolQuality) {
    const diversity = diversityByRoleKey.get(quality.roleKey) ?? null;
    const isRequired = quality.priority === "required";

    if (quality.poolQualityStatus === "empty") {
      emptyPoolCount += 1;
      if (isRequired) {
        requiredEmptyPoolCount += 1;
      }
    }

    if (quality.poolQualityStatus === "thin") {
      thinPoolCount += 1;
    }

    if (quality.poolQualityStatus === "weak") {
      weakPoolCount += 1;
      if (isRequired) {
        requiredWeakPoolCount += 1;
      }
    }

    if (diversity?.poolDiversityStatus === "narrow") {
      narrowPoolCount += 1;
    }

    if (diversity?.poolDiversityStatus === "scattered") {
      scatteredPoolCount += 1;
      if (isRequired) {
        requiredScatteredPoolCount += 1;
      }
    }
  }

  return {
    totalRoleCount: rolePoolQuality.length,
    requiredRoleCount: rolePoolQuality.filter((summary) => summary.priority === "required").length,
    emptyPoolCount,
    thinPoolCount,
    weakPoolCount,
    narrowPoolCount,
    scatteredPoolCount,
    requiredEmptyPoolCount,
    requiredWeakPoolCount,
    requiredScatteredPoolCount,
    manualReviewSuggested:
      requiredEmptyPoolCount > 0 || requiredWeakPoolCount > 0 || requiredScatteredPoolCount > 0
  };
}
