import type { RoleScopedCandidatePool, RoleScopedRankedProductMatch } from "./product-matching";
import type { ProductMatchRequest } from "./product-matching";
import {
  classifyProductMatchDimensionFit,
  type ProductMatchDimensionFit
} from "./product-matching-dimensions";
import {
  classifyProductMatchEvidenceCompleteness,
  type ProductMatchEvidenceCompleteness
} from "./product-matching-evidence";
import { classifyCatalogTimestampFreshness, type CatalogTimestampFreshness } from "./product-matching-freshness";

export type ProductMatchVisualStatus =
  | "strong_match"
  | "acceptable_match"
  | "closest_available"
  | "missing_required"
  | "missing_supporting";

export type ProductMatchConfidenceTier = "strong" | "acceptable" | "weak" | "missing" | "invalid_selection";

export type ProductMatchRoleResultEvidence = {
  category: string;
  roleLabel: string;
  status: ProductMatchVisualStatus;
  productId: string | null;
  reason: string;
};

export type ProductMatchRoleConfidence = {
  category: string;
  roleLabel: string;
  roleKey: string;
  status: ProductMatchVisualStatus | "not_evaluated";
  selectedProductId: string | null;
  candidateCount: number;
  rejectedCount: number;
  rejectionReasons: Record<string, number>;
  confidenceTier: ProductMatchConfidenceTier;
  reasons: string[];
  weaknessReasons: string[];
  hasColorMismatch: boolean;
  hasWeakMaterialMatch: boolean;
  selectedProductDimensionFit: ProductMatchDimensionFit | null;
  selectedProductEvidenceCompleteness: ProductMatchEvidenceCompleteness | null;
  selectedProductFreshness: CatalogTimestampFreshness | null;
};

export type ProductMatchRequiredRoleDescriptor = {
  roleKey: string;
  category: string;
  roleLabel: string;
};

export type ProductMatchQaStopRuleIssueCode =
  | "required_role_not_reported"
  | "required_pool_empty"
  | "required_role_missing"
  | "required_closest_available"
  | "invalid_selection"
  | "required_color_mismatch"
  | "required_freshness_stale"
  | "required_freshness_missing"
  | "required_freshness_invalid"
  | "required_dimension_oversized"
  | "required_dimension_missing"
  | "required_evidence_partial"
  | "required_evidence_weak"
  | "supporting_role_issue"
  | "weak_material_match";

export type ProductMatchQaStopRuleIssue = {
  code: ProductMatchQaStopRuleIssueCode;
  severity: "blocker" | "warning";
  roleKey: string;
  roleLabel: string;
  message: string;
};

export type ProductMatchQaStopRuleStatus = {
  passesQaStopRules: boolean;
  blockers: ProductMatchQaStopRuleIssue[];
  warnings: ProductMatchQaStopRuleIssue[];
  counts: {
    blockerCount: number;
    warningCount: number;
    missingRequiredRoleCount: number;
    closestAvailableRequiredCount: number;
    invalidSelectionCount: number;
    colorMismatchRequiredCount: number;
    weakMaterialRequiredCount: number;
    staleRequiredFreshnessCount: number;
    missingRequiredFreshnessCount: number;
    invalidRequiredFreshnessCount: number;
    oversizedRequiredDimensionCount: number;
    missingRequiredDimensionCount: number;
    partialRequiredEvidenceCount: number;
    weakRequiredEvidenceCount: number;
    emptyRequiredPoolCount: number;
  };
};

export function productMatchRoleKey(category: string, roleLabel: string) {
  return `${normalizeRoleKeyPart(category)}::${normalizeRoleKeyPart(roleLabel)}`;
}

export function normalizeProductMatchRoleResultCategory(category: string, roleLabel: string) {
  const normalizedCategory = normalizeRoleKeyPart(category);
  const text = `${category} ${roleLabel}`.toLowerCase();

  if (normalizedCategory === "side_tables") {
    return "side_tables";
  }

  if (text.includes("dining") && text.includes("chair")) {
    return "chairs";
  }

  if (text.includes("headboard")) {
    return "headboards";
  }

  if (text.includes("nightstand") || (text.includes("bedside") && text.includes("table"))) {
    return "side_tables";
  }

  if (text.includes("dining") && text.includes("table")) {
    return "dining_tables";
  }

  if (text.includes("desk")) {
    return "desks";
  }

  if (text.includes("office") && text.includes("chair")) {
    return "office_chairs";
  }

  if (text.includes("armchair") || text.includes("chair") || text.includes("lounge")) {
    return "armchairs";
  }

  if (text.includes("sofa") || text.includes("sectional") || text.includes("seating")) {
    return "sofas";
  }

  if (text.includes("coffee")) {
    return "coffee_tables";
  }

  if (text.includes("side table") || text.includes("side_tables") || text.includes("occasional")) {
    return "side_tables";
  }

  if (text.includes("rug") || text.includes("flatweave")) {
    return "rugs";
  }

  if (text.includes("wall") || text.includes("art") || text.includes("canvas")) {
    return "wall_art";
  }

  if (text.includes("lamp") || text.includes("light") || text.includes("pendant")) {
    return "lighting";
  }

  if (text.includes("mirror")) {
    return "mirrors";
  }

  if (text.includes("decor") || text.includes("vase") || text.includes("cushion")) {
    return "decor";
  }

  if (text.includes("console") || text.includes("storage") || text.includes("media")) {
    return "storage";
  }

  if (isBedRoleText(text, normalizedCategory)) {
    return "beds";
  }

  return normalizedCategory;
}

export function buildProductMatchConfidenceSummary({
  pools,
  roleResults = [],
  nowMs,
  roomMeasurements = null
}: {
  pools: RoleScopedCandidatePool[];
  roleResults?: ProductMatchRoleResultEvidence[];
  nowMs?: number;
  roomMeasurements?: ProductMatchRequest["roomMeasurements"];
}): ProductMatchRoleConfidence[] {
  const roleResultsByKey = new Map(
    roleResults.map((result) => [productMatchRoleKey(result.category, result.roleLabel), result])
  );

  return pools.map((pool) => {
    const key = productMatchRoleKey(pool.role.category, pool.role.label);
    const roleResult = roleResultsByKey.get(key) ?? null;
    const selectedCandidate = selectedCandidateForRole(pool, roleResult?.productId ?? null);
    const invalidSelection = Boolean(roleResult?.productId && !selectedCandidate);
    const status = roleResult?.status ?? "not_evaluated";
    const attributeScore = selectedCandidate?.attributeScore ?? null;
    const weaknessReasons = Array.from(
      new Set([
        ...pool.weaknessReasons,
        ...(attributeScore?.weaknessReasons ?? []),
        ...(invalidSelection ? [`selected product ${roleResult?.productId} is outside this role pool`] : [])
      ])
    );
    const reasons = [
      roleResult?.reason ? `visual status: ${roleResult.reason}` : null,
      selectedCandidate?.selectionReason ?? null,
      invalidSelection ? "selected product was ignored because it is outside this role pool" : null
    ].filter((reason): reason is string => Boolean(reason));

    return {
      category: pool.role.category,
      roleLabel: pool.role.label,
      roleKey: key,
      status,
      selectedProductId: selectedCandidate?.id ?? null,
      candidateCount: pool.candidateCount,
      rejectedCount: pool.rejectedCount,
      rejectionReasons: pool.rejectionReasons,
      confidenceTier: confidenceTierFor({ status, selectedCandidate, invalidSelection }),
      reasons,
      weaknessReasons,
      hasColorMismatch: Boolean(attributeScore && attributeScore.color < 0),
      hasWeakMaterialMatch: Boolean(attributeScore && attributeScore.material < 0),
      selectedProductDimensionFit: selectedCandidate
        ? classifyProductMatchDimensionFit({ candidate: selectedCandidate, roomMeasurements })
        : null,
      selectedProductEvidenceCompleteness: selectedCandidate
        ? classifyProductMatchEvidenceCompleteness(selectedCandidate)
        : null,
      selectedProductFreshness:
        selectedCandidate && nowMs !== undefined
          ? classifyCatalogTimestampFreshness({
              lastCheckedAt: selectedCandidate.lastCheckedAt,
              nowMs
            })
          : null
    };
  });
}

export function productMatchConfidenceOutputSummary({
  pools,
  roleResults = [],
  nowMs,
  roomMeasurements = null
}: {
  pools: RoleScopedCandidatePool[];
  roleResults?: ProductMatchRoleResultEvidence[];
  nowMs?: number;
  roomMeasurements?: ProductMatchRequest["roomMeasurements"];
}) {
  return buildProductMatchConfidenceSummary({ pools, roleResults, nowMs, roomMeasurements }).map((summary) => ({
    category: summary.category,
    roleLabel: summary.roleLabel,
    roleKey: summary.roleKey,
    status: summary.status,
    selectedProductId: summary.selectedProductId,
    candidateCount: summary.candidateCount,
    rejectedCount: summary.rejectedCount,
    rejectionReasons: summary.rejectionReasons,
    confidenceTier: summary.confidenceTier,
    reasons: summary.reasons,
    weaknessReasons: summary.weaknessReasons,
    hasColorMismatch: summary.hasColorMismatch,
    hasWeakMaterialMatch: summary.hasWeakMaterialMatch,
    selectedProductDimensionFit: summary.selectedProductDimensionFit,
    selectedProductEvidenceCompleteness: summary.selectedProductEvidenceCompleteness,
    selectedProductFreshness: summary.selectedProductFreshness
  }));
}

export function productMatchRequiredRoleDescriptor({
  category,
  roleLabel
}: {
  category: string;
  roleLabel: string;
}): ProductMatchRequiredRoleDescriptor {
  return {
    category,
    roleLabel,
    roleKey: productMatchRoleKey(category, roleLabel)
  };
}

export function buildProductMatchQaStopRuleStatus({
  roleConfidence,
  requiredRoles
}: {
  roleConfidence: ProductMatchRoleConfidence[];
  requiredRoles: ProductMatchRequiredRoleDescriptor[];
}): ProductMatchQaStopRuleStatus {
  const requiredByKey = new Map(requiredRoles.map((role) => [role.roleKey, role]));
  const confidenceByKey = new Map(roleConfidence.map((role) => [role.roleKey, role]));
  const blockers: ProductMatchQaStopRuleIssue[] = [];
  const warnings: ProductMatchQaStopRuleIssue[] = [];

  for (const requiredRole of requiredRoles) {
    if (!confidenceByKey.has(requiredRole.roleKey)) {
      blockers.push(
        stopRuleIssue({
          code: "required_role_not_reported",
          severity: "blocker",
          roleKey: requiredRole.roleKey,
          roleLabel: requiredRole.roleLabel,
          message: "Required role was not present in role confidence metadata."
        })
      );
    }
  }

  for (const role of roleConfidence) {
    const isRequired = requiredByKey.has(role.roleKey);

    if (role.confidenceTier === "invalid_selection") {
      blockers.push(
        stopRuleIssue({
          code: "invalid_selection",
          severity: "blocker",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: "Selected product is outside this role's candidate pool."
        })
      );
      continue;
    }

    if (isRequired && role.candidateCount === 0) {
      blockers.push(
        stopRuleIssue({
          code: "required_pool_empty",
          severity: "blocker",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: "Required role has an empty candidate pool."
        })
      );
    }

    if (isRequired && (role.confidenceTier === "missing" || role.status === "missing_required")) {
      blockers.push(
        stopRuleIssue({
          code: "required_role_missing",
          severity: "blocker",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: "Required role is missing a selected product."
        })
      );
    }

    if (isRequired && role.status === "closest_available") {
      blockers.push(
        stopRuleIssue({
          code: "required_closest_available",
          severity: "blocker",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: "Required role is only closest available."
        })
      );
    }

    if (isRequired && role.hasColorMismatch) {
      blockers.push(
        stopRuleIssue({
          code: "required_color_mismatch",
          severity: "blocker",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: "Required role selected product has a color mismatch."
        })
      );
    }

    if (role.hasWeakMaterialMatch) {
      const issue = stopRuleIssue({
        code: "weak_material_match",
        severity: "warning",
        roleKey: role.roleKey,
        roleLabel: role.roleLabel,
        message: isRequired
          ? "Required role selected product has a weak material match."
          : "Supporting role selected product has a weak material match."
      });
      warnings.push(issue);
    }

    if (isRequired && role.selectedProductFreshness?.catalogFreshnessStatus === "stale") {
      warnings.push(
        stopRuleIssue({
          code: "required_freshness_stale",
          severity: "warning",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: requiredFreshnessWarningMessage(role, "stale")
        })
      );
    }

    if (isRequired && role.selectedProductFreshness?.catalogFreshnessStatus === "missing") {
      warnings.push(
        stopRuleIssue({
          code: "required_freshness_missing",
          severity: "warning",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: requiredFreshnessWarningMessage(role, "missing")
        })
      );
    }

    if (isRequired && role.selectedProductFreshness?.catalogFreshnessStatus === "invalid") {
      warnings.push(
        stopRuleIssue({
          code: "required_freshness_invalid",
          severity: "warning",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: requiredFreshnessWarningMessage(role, "invalid")
        })
      );
    }

    if (isRequired && isOversizedDimensionFit(role.selectedProductDimensionFit)) {
      warnings.push(
        stopRuleIssue({
          code: "required_dimension_oversized",
          severity: "warning",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: requiredDimensionWarningMessage(
            role,
            "Required role selected product may not fit entered room measurements."
          )
        })
      );
    }

    if (isRequired && isMissingDimensionFit(role.selectedProductDimensionFit)) {
      warnings.push(
        stopRuleIssue({
          code: "required_dimension_missing",
          severity: "warning",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: requiredDimensionWarningMessage(
            role,
            "Required role selected product fit could not be fully checked from dimensions."
          )
        })
      );
    }

    if (isRequired && role.selectedProductEvidenceCompleteness?.status === "partial") {
      warnings.push(
        stopRuleIssue({
          code: "required_evidence_partial",
          severity: "warning",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: requiredEvidenceWarningMessage(role, "partial")
        })
      );
    }

    if (isRequired && role.selectedProductEvidenceCompleteness?.status === "weak") {
      warnings.push(
        stopRuleIssue({
          code: "required_evidence_weak",
          severity: "warning",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: requiredEvidenceWarningMessage(role, "weak")
        })
      );
    }

    if (!isRequired && hasSupportingIssue(role)) {
      warnings.push(
        stopRuleIssue({
          code: "supporting_role_issue",
          severity: "warning",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: supportingRoleWarningMessage(role)
        })
      );
    }
  }

  return {
    passesQaStopRules: blockers.length === 0,
    blockers,
    warnings,
    counts: {
      blockerCount: blockers.length,
      warningCount: warnings.length,
      missingRequiredRoleCount: blockers.filter((issue) => issue.code === "required_role_missing").length,
      closestAvailableRequiredCount: blockers.filter((issue) => issue.code === "required_closest_available").length,
      invalidSelectionCount: blockers.filter((issue) => issue.code === "invalid_selection").length,
      colorMismatchRequiredCount: blockers.filter((issue) => issue.code === "required_color_mismatch").length,
      weakMaterialRequiredCount: warnings.filter((issue) => {
        const role = confidenceByKey.get(issue.roleKey);
        return issue.code === "weak_material_match" && Boolean(role && requiredByKey.has(role.roleKey));
      }).length,
      staleRequiredFreshnessCount: warnings.filter((issue) => issue.code === "required_freshness_stale").length,
      missingRequiredFreshnessCount: warnings.filter((issue) => issue.code === "required_freshness_missing").length,
      invalidRequiredFreshnessCount: warnings.filter((issue) => issue.code === "required_freshness_invalid").length,
      oversizedRequiredDimensionCount: warnings.filter((issue) => issue.code === "required_dimension_oversized").length,
      missingRequiredDimensionCount: warnings.filter((issue) => issue.code === "required_dimension_missing").length,
      partialRequiredEvidenceCount: warnings.filter((issue) => issue.code === "required_evidence_partial").length,
      weakRequiredEvidenceCount: warnings.filter((issue) => issue.code === "required_evidence_weak").length,
      emptyRequiredPoolCount: blockers.filter((issue) => issue.code === "required_pool_empty").length
    }
  };
}

export function productMatchQaStopRuleOutputSummary({
  roleConfidence,
  requiredRoles
}: {
  roleConfidence: ProductMatchRoleConfidence[];
  requiredRoles: ProductMatchRequiredRoleDescriptor[];
}) {
  const status = buildProductMatchQaStopRuleStatus({ roleConfidence, requiredRoles });

  return {
    passesQaStopRules: status.passesQaStopRules,
    counts: status.counts,
    blockers: status.blockers,
    warnings: status.warnings
  };
}

function normalizeRoleKeyPart(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function isBedRoleText(text: string, normalizedCategory: string) {
  if (normalizedCategory === "beds") {
    return true;
  }

  return /\bbed(s)?\b/.test(text);
}

function stopRuleIssue(issue: ProductMatchQaStopRuleIssue): ProductMatchQaStopRuleIssue {
  return issue;
}

function requiredFreshnessWarningMessage(
  role: ProductMatchRoleConfidence,
  status: "stale" | "missing" | "invalid"
) {
  const freshness = role.selectedProductFreshness;

  if (status === "stale" && freshness?.ageDays !== null && freshness?.ageDays !== undefined) {
    return `Required role selected product catalog timestamp is stale: ${freshness.ageDays} days old, threshold ${freshness.thresholdDays} days.`;
  }

  if (status === "invalid" && freshness?.checkedAt) {
    return `Required role selected product catalog timestamp is invalid: ${freshness.checkedAt}.`;
  }

  return `Required role selected product catalog timestamp is ${status}.`;
}

function requiredDimensionWarningMessage(role: ProductMatchRoleConfidence, fallback: string) {
  const detail = role.selectedProductDimensionFit?.warnings.join(" ");

  return detail ? `${fallback}: ${detail}` : fallback;
}

function requiredEvidenceWarningMessage(
  role: ProductMatchRoleConfidence,
  status: "partial" | "weak"
) {
  const evidence = role.selectedProductEvidenceCompleteness;
  const detail = evidence?.warnings.join(" ");

  return detail
    ? `Required role selected product has ${status} catalog evidence: ${detail}`
    : `Required role selected product has ${status} catalog evidence.`;
}

function supportingRoleWarningMessage(role: ProductMatchRoleConfidence) {
  if (role.status === "missing_supporting" || role.confidenceTier === "missing") {
    return "Supporting role needs manual QA review: no supporting product was selected.";
  }

  if (role.status === "closest_available") {
    return "Supporting role needs manual QA review: selected product is only closest available.";
  }

  if (role.candidateCount === 0) {
    return "Supporting role needs manual QA review: role candidate pool is empty.";
  }

  if (role.hasColorMismatch) {
    return "Supporting role needs manual QA review: selected product has a color mismatch.";
  }

  return "Supporting role needs manual QA review.";
}

function hasSupportingIssue(role: ProductMatchRoleConfidence) {
  return (
    role.status === "closest_available" ||
    role.status === "missing_supporting" ||
    role.confidenceTier === "missing" ||
    role.hasColorMismatch ||
    role.candidateCount === 0
  );
}

function isOversizedDimensionFit(fit: ProductMatchDimensionFit | null) {
  return (
    fit?.status === "oversized_width" ||
    fit?.status === "oversized_depth" ||
    fit?.status === "oversized_width_and_depth"
  );
}

function isMissingDimensionFit(fit: ProductMatchDimensionFit | null) {
  return fit?.status === "missing_product_dimensions" || fit?.status === "missing_room_measurements";
}

function selectedCandidateForRole(pool: RoleScopedCandidatePool, productId: string | null) {
  if (!productId) {
    return null;
  }

  return pool.candidates.find((candidate) => candidate.id === productId) ?? null;
}

function confidenceTierFor({
  status,
  selectedCandidate,
  invalidSelection
}: {
  status: ProductMatchRoleConfidence["status"];
  selectedCandidate: RoleScopedRankedProductMatch | null;
  invalidSelection: boolean;
}): ProductMatchConfidenceTier {
  if (invalidSelection) {
    return "invalid_selection";
  }

  if (status === "missing_required" || status === "missing_supporting" || !selectedCandidate) {
    return "missing";
  }

  if (status === "strong_match") {
    return "strong";
  }

  if (status === "acceptable_match") {
    return "acceptable";
  }

  if (status === "closest_available") {
    return "weak";
  }

  return selectedCandidate.attributeScore.color < 0 || selectedCandidate.attributeScore.material < 0
    ? "weak"
    : "acceptable";
}
