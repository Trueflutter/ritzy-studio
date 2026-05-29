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
  | "required_pool_thin"
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
    thinRequiredPoolCount: number;
  };
};

export type ProductMatchQaWarningRolePriority = "required" | "supporting";

export type ProductMatchQaWarningDimensionGroup =
  | "missing_structured_dimensions"
  | "title_derived_dimensions_present"
  | "missing_room_measurements"
  | "fit_checked"
  | "oversized_dimensions"
  | "not_applicable";

export type ProductMatchQaWarningEvidenceField =
  | "canonical_url"
  | "image"
  | "price"
  | "availability"
  | "color"
  | "material"
  | "style_room"
  | "dimension";

export type ProductMatchQaWarningReportItem = ProductMatchQaStopRuleIssue & {
  rolePriority: ProductMatchQaWarningRolePriority;
  selectedProductId: string | null;
  dimensionGroup: ProductMatchQaWarningDimensionGroup;
  missingEvidenceFields: ProductMatchQaWarningEvidenceField[];
  freshnessStatus: CatalogTimestampFreshness["catalogFreshnessStatus"] | "not_checked";
};

export type ProductMatchQaWarningRoleReport = {
  roleKey: string;
  roleLabel: string;
  rolePriority: ProductMatchQaWarningRolePriority;
  selectedProductId: string | null;
  status: ProductMatchRoleConfidence["status"];
  confidenceTier: ProductMatchConfidenceTier;
  candidateCount: number;
  severityCounts: Record<ProductMatchQaStopRuleIssue["severity"], number>;
  issueCodes: ProductMatchQaStopRuleIssueCode[];
  dimensionGroup: ProductMatchQaWarningDimensionGroup;
  missingEvidenceFields: ProductMatchQaWarningEvidenceField[];
  freshnessStatus: CatalogTimestampFreshness["catalogFreshnessStatus"] | "not_checked";
};

export type ProductMatchQaWarningReport = {
  passesQaStopRules: boolean;
  totalIssueCount: number;
  severityCounts: Record<ProductMatchQaStopRuleIssue["severity"], number>;
  issueCodeCounts: Partial<Record<ProductMatchQaStopRuleIssueCode, number>>;
  roleIssueCounts: Record<string, number>;
  productIssueCounts: Record<string, number>;
  dimensionGroupCounts: Record<ProductMatchQaWarningDimensionGroup, number>;
  missingEvidenceFieldCounts: Record<ProductMatchQaWarningEvidenceField, number>;
  freshnessStatusCounts: Record<CatalogTimestampFreshness["catalogFreshnessStatus"] | "not_checked", number>;
  roles: ProductMatchQaWarningRoleReport[];
  issues: ProductMatchQaWarningReportItem[];
};

export type ProductMatchVisualSourcingDiagnostics = {
  isolationReason?:
    | "visual_sourcing_completed"
    | "visual_sourcing_timeout_text_fallback"
    | "visual_sourcing_skipped_product_images_disabled_text_fallback"
    | "retry_visual_sourcing_timeout"
    | "retry_visual_sourcing_skipped_product_images_disabled_text_fallback"
    | "visual_sourcing_failed_without_timeout";
  initialAttemptDurationMs: number | null;
  timeoutMs: number | null;
  timedOut: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  candidateCount: number;
  rolePoolCount: number;
  productCandidateImagesEnabled?: boolean;
  retry?: {
    attempted: boolean;
    attemptDurationMs: number | null;
    timedOut: boolean;
    fallbackUsed: boolean;
    fallbackReason: string | null;
    providerImageDownloadFailure: boolean;
    imageGateUsable: boolean | null;
  };
};

export type ProductMatchVisualSourcingEvidenceStatus =
  | "visual_sourcing_succeeded"
  | "visual_sourcing_timeout_text_fallback"
  | "visual_sourcing_skipped_text_fallback"
  | "retry_visual_sourcing_timeout"
  | "retry_visual_sourcing_skipped_text_fallback"
  | "visual_sourcing_timeout_no_fallback"
  | "text_fallback_without_timeout"
  | "visual_sourcing_not_attempted";

export type ProductMatchVisualSourcingEvidence = {
  status: ProductMatchVisualSourcingEvidenceStatus;
  timedOut: boolean;
  fallbackUsed: boolean;
  fallbackReason: string | null;
  initialAttemptDurationMs: number | null;
  timeoutMs: number | null;
  candidateCount: number;
  rolePoolCount: number;
  retry: ProductMatchVisualSourcingDiagnostics["retry"] | null;
  textFallbackRoleCount: number;
  needsSemanticReview: boolean;
  notes: string[];
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

    if (isRequired && role.candidateCount > 0 && role.candidateCount < 2) {
      warnings.push(
        stopRuleIssue({
          code: "required_pool_thin",
          severity: "warning",
          roleKey: role.roleKey,
          roleLabel: role.roleLabel,
          message: `Required role has only ${role.candidateCount} candidate in its option pool.`
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
          message: requiredClosestAvailableMessage(role)
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
      emptyRequiredPoolCount: blockers.filter((issue) => issue.code === "required_pool_empty").length,
      thinRequiredPoolCount: warnings.filter((issue) => issue.code === "required_pool_thin").length
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

export function buildProductMatchVisualSourcingEvidence({
  diagnostics,
  roleConfidence = []
}: {
  diagnostics: ProductMatchVisualSourcingDiagnostics | null | undefined;
  roleConfidence?: ProductMatchRoleConfidence[];
}): ProductMatchVisualSourcingEvidence {
  if (!diagnostics) {
    return {
      status: "visual_sourcing_not_attempted",
      timedOut: false,
      fallbackUsed: false,
      fallbackReason: null,
      initialAttemptDurationMs: null,
      timeoutMs: null,
      candidateCount: 0,
      rolePoolCount: 0,
      retry: null,
      textFallbackRoleCount: 0,
      needsSemanticReview: false,
      notes: ["Visual sourcing diagnostics were not present in the audit summary."]
    };
  }

  const textFallbackRoleCount = roleConfidence.filter(roleHasTextFallbackEvidence).length;
  const status = visualSourcingEvidenceStatus(diagnostics);
  const notes = visualSourcingEvidenceNotes({ diagnostics, status, textFallbackRoleCount });

  return {
    status,
    timedOut: diagnostics.timedOut,
    fallbackUsed: diagnostics.fallbackUsed,
    fallbackReason: diagnostics.fallbackReason,
    initialAttemptDurationMs: diagnostics.initialAttemptDurationMs,
    timeoutMs: diagnostics.timeoutMs,
    candidateCount: diagnostics.candidateCount,
    rolePoolCount: diagnostics.rolePoolCount,
    retry: diagnostics.retry ?? null,
    textFallbackRoleCount,
    needsSemanticReview: status !== "visual_sourcing_succeeded",
    notes
  };
}

export function buildProductMatchQaWarningReport({
  roleConfidence,
  requiredRoles
}: {
  roleConfidence: ProductMatchRoleConfidence[];
  requiredRoles: ProductMatchRequiredRoleDescriptor[];
}): ProductMatchQaWarningReport {
  const status = buildProductMatchQaStopRuleStatus({ roleConfidence, requiredRoles });
  const requiredRoleKeys = new Set(requiredRoles.map((role) => role.roleKey));
  const confidenceByKey = new Map(roleConfidence.map((role) => [role.roleKey, role]));
  const severityCounts = emptySeverityCounts();
  const issueCodeCounts: Partial<Record<ProductMatchQaStopRuleIssueCode, number>> = {};
  const roleIssueCounts: Record<string, number> = {};
  const productIssueCounts: Record<string, number> = {};
  const dimensionGroupCounts = emptyDimensionGroupCounts();
  const missingEvidenceFieldCounts = emptyEvidenceFieldCounts();
  const freshnessStatusCounts = emptyFreshnessStatusCounts();
  const allIssues = [...status.blockers, ...status.warnings];
  const issues = allIssues.map((issue) => {
    const role = confidenceByKey.get(issue.roleKey) ?? null;
    const item = warningReportItem(issue, role, requiredRoleKeys);

    increment(severityCounts, item.severity);
    increment(issueCodeCounts, item.code);
    increment(roleIssueCounts, item.roleKey);
    increment(productIssueCounts, item.selectedProductId ?? "none");

    return item;
  });
  const issuesByRole = new Map<string, ProductMatchQaWarningReportItem[]>();
  for (const issue of issues) {
    const roleIssues = issuesByRole.get(issue.roleKey) ?? [];
    roleIssues.push(issue);
    issuesByRole.set(issue.roleKey, roleIssues);
  }
  const roles = roleConfidence.map((role) => {
    const roleIssues = issuesByRole.get(role.roleKey) ?? [];

    return {
      roleKey: role.roleKey,
      roleLabel: role.roleLabel,
      rolePriority: requiredRoleKeys.has(role.roleKey)
        ? ("required" as const)
        : ("supporting" as const),
      selectedProductId: role.selectedProductId,
      status: role.status,
      confidenceTier: role.confidenceTier,
      candidateCount: role.candidateCount,
      severityCounts: {
        blocker: roleIssues.filter((issue) => issue.severity === "blocker").length,
        warning: roleIssues.filter((issue) => issue.severity === "warning").length
      },
      issueCodes: Array.from(new Set(roleIssues.map((issue) => issue.code))),
      dimensionGroup: dimensionGroupForRole(role),
      missingEvidenceFields: missingEvidenceFieldsForRole(role),
      freshnessStatus: freshnessStatusForRole(role)
    };
  });
  for (const role of roles) {
    increment(dimensionGroupCounts, role.dimensionGroup);
    increment(freshnessStatusCounts, role.freshnessStatus);
    for (const field of role.missingEvidenceFields) {
      increment(missingEvidenceFieldCounts, field);
    }
  }

  return {
    passesQaStopRules: status.passesQaStopRules,
    totalIssueCount: issues.length,
    severityCounts,
    issueCodeCounts,
    roleIssueCounts,
    productIssueCounts,
    dimensionGroupCounts,
    missingEvidenceFieldCounts,
    freshnessStatusCounts,
    roles,
    issues
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

function requiredClosestAvailableMessage(role: ProductMatchRoleConfidence) {
  const details = [
    `candidate pool has ${role.candidateCount} candidate${role.candidateCount === 1 ? "" : "s"}`,
    role.rejectedCount > 0
      ? `${role.rejectedCount} catalogue candidate${role.rejectedCount === 1 ? "" : "s"} rejected (${topRecordEntries(
          role.rejectionReasons
        ).join(", ")})`
      : null,
    role.weaknessReasons.length > 0 ? `weakness: ${role.weaknessReasons.slice(0, 3).join("; ")}` : null,
    role.selectedProductEvidenceCompleteness?.warnings.length
      ? `metadata gaps: ${role.selectedProductEvidenceCompleteness.warnings.slice(0, 3).join("; ")}`
      : null,
    role.selectedProductDimensionFit?.warnings.length
      ? `dimension evidence: ${role.selectedProductDimensionFit.warnings.slice(0, 2).join("; ")}`
      : null
  ].filter((detail): detail is string => Boolean(detail));

  return `Required role is only closest available; ${details.join("; ")}.`;
}

function topRecordEntries(record: Record<string, number>) {
  return Object.entries(record)
    .sort(([, left], [, right]) => right - left)
    .slice(0, 3)
    .map(([key, count]) => `${key}: ${count}`);
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

function warningReportItem(
  issue: ProductMatchQaStopRuleIssue,
  role: ProductMatchRoleConfidence | null,
  requiredRoleKeys: Set<string>
): ProductMatchQaWarningReportItem {
  return {
    ...issue,
    rolePriority: requiredRoleKeys.has(issue.roleKey) ? "required" : "supporting",
    selectedProductId: role?.selectedProductId ?? null,
    dimensionGroup: role ? dimensionGroupForRole(role) : "not_applicable",
    missingEvidenceFields: role ? missingEvidenceFieldsForRole(role) : [],
    freshnessStatus: role ? freshnessStatusForRole(role) : "not_checked"
  };
}

function dimensionGroupForRole(role: ProductMatchRoleConfidence): ProductMatchQaWarningDimensionGroup {
  const fit = role.selectedProductDimensionFit;

  if (!fit) {
    return "not_applicable";
  }

  if (fit.status === "missing_product_dimensions") {
    return fit.sourceText ? "title_derived_dimensions_present" : "missing_structured_dimensions";
  }

  if (fit.status === "missing_room_measurements") {
    return "missing_room_measurements";
  }

  if (isOversizedDimensionFit(fit)) {
    return "oversized_dimensions";
  }

  return "fit_checked";
}

function missingEvidenceFieldsForRole(role: ProductMatchRoleConfidence): ProductMatchQaWarningEvidenceField[] {
  const checks = role.selectedProductEvidenceCompleteness?.checks;

  if (!checks) {
    return [];
  }

  return [
    checks.hasCanonicalUrl ? null : "canonical_url",
    checks.hasPrimaryImage ? null : "image",
    checks.hasPrice ? null : "price",
    checks.hasAvailability ? null : "availability",
    checks.hasColorSignal ? null : "color",
    checks.hasMaterialSignal ? null : "material",
    checks.hasStyleOrRoomSignal ? null : "style_room",
    checks.hasDimensions ? null : "dimension"
  ].filter((field): field is ProductMatchQaWarningEvidenceField => Boolean(field));
}

function freshnessStatusForRole(
  role: ProductMatchRoleConfidence
): CatalogTimestampFreshness["catalogFreshnessStatus"] | "not_checked" {
  return role.selectedProductFreshness?.catalogFreshnessStatus ?? "not_checked";
}

function emptySeverityCounts(): Record<ProductMatchQaStopRuleIssue["severity"], number> {
  return {
    blocker: 0,
    warning: 0
  };
}

function emptyDimensionGroupCounts(): Record<ProductMatchQaWarningDimensionGroup, number> {
  return {
    missing_structured_dimensions: 0,
    title_derived_dimensions_present: 0,
    missing_room_measurements: 0,
    fit_checked: 0,
    oversized_dimensions: 0,
    not_applicable: 0
  };
}

function emptyEvidenceFieldCounts(): Record<ProductMatchQaWarningEvidenceField, number> {
  return {
    canonical_url: 0,
    image: 0,
    price: 0,
    availability: 0,
    color: 0,
    material: 0,
    style_room: 0,
    dimension: 0
  };
}

function emptyFreshnessStatusCounts(): Record<
  CatalogTimestampFreshness["catalogFreshnessStatus"] | "not_checked",
  number
> {
  return {
    fresh: 0,
    stale: 0,
    missing: 0,
    invalid: 0,
    not_checked: 0
  };
}

function increment<TKey extends string>(counts: Partial<Record<TKey, number>>, key: TKey) {
  counts[key] = (counts[key] ?? 0) + 1;
}

function selectedCandidateForRole(pool: RoleScopedCandidatePool, productId: string | null) {
  if (!productId) {
    return null;
  }

  return pool.candidates.find((candidate) => candidate.id === productId) ?? null;
}

function roleHasTextFallbackEvidence(role: ProductMatchRoleConfidence) {
  return role.reasons.some((reason) => /text fallback|without provider visual reasoning/i.test(reason));
}

function visualSourcingEvidenceStatus(
  diagnostics: ProductMatchVisualSourcingDiagnostics
): ProductMatchVisualSourcingEvidenceStatus {
  if (diagnostics.isolationReason === "retry_visual_sourcing_timeout" || diagnostics.retry?.timedOut) {
    return "retry_visual_sourcing_timeout";
  }

  if (diagnostics.isolationReason === "retry_visual_sourcing_skipped_product_images_disabled_text_fallback") {
    return "retry_visual_sourcing_skipped_text_fallback";
  }

  if (diagnostics.isolationReason === "visual_sourcing_timeout_text_fallback") {
    return "visual_sourcing_timeout_text_fallback";
  }

  if (diagnostics.isolationReason === "visual_sourcing_skipped_product_images_disabled_text_fallback") {
    return "visual_sourcing_skipped_text_fallback";
  }

  if (diagnostics.isolationReason === "visual_sourcing_failed_without_timeout") {
    return "text_fallback_without_timeout";
  }

  if (diagnostics.timedOut && diagnostics.fallbackUsed) {
    return "visual_sourcing_timeout_text_fallback";
  }

  if (diagnostics.timedOut) {
    return "visual_sourcing_timeout_no_fallback";
  }

  if (diagnostics.fallbackUsed) {
    return "text_fallback_without_timeout";
  }

  return "visual_sourcing_succeeded";
}

function visualSourcingEvidenceNotes({
  diagnostics,
  status,
  textFallbackRoleCount
}: {
  diagnostics: ProductMatchVisualSourcingDiagnostics;
  status: ProductMatchVisualSourcingEvidenceStatus;
  textFallbackRoleCount: number;
}) {
  const notes: string[] = [];

  if (status === "visual_sourcing_timeout_text_fallback") {
    notes.push("Visual sourcing timed out and deterministic text fallback was used.");
    notes.push("Review semantic product matching separately from provider visual reasoning.");
  } else if (status === "visual_sourcing_skipped_text_fallback") {
    notes.push("Visual sourcing was skipped because product candidate images were disabled.");
    notes.push("Deterministic text fallback was used without waiting for provider visual reasoning.");
  } else if (status === "retry_visual_sourcing_timeout") {
    notes.push("Initial visual sourcing completed, but retry visual sourcing timed out.");
    notes.push("Review retry timeout separately from semantic product matching quality.");
  } else if (status === "retry_visual_sourcing_skipped_text_fallback") {
    notes.push("Retry visual sourcing was skipped because product candidate images were disabled.");
    notes.push("Deterministic retry fallback was used without waiting for provider visual reasoning.");
  } else if (status === "visual_sourcing_timeout_no_fallback") {
    notes.push("Visual sourcing timed out and no fallback selection was recorded.");
  } else if (status === "text_fallback_without_timeout") {
    notes.push("Text fallback was used without a recorded visual-sourcing timeout.");
  } else {
    notes.push("Visual sourcing completed without recorded timeout fallback.");
  }

  if (textFallbackRoleCount > 0) {
    notes.push(`${textFallbackRoleCount} role result(s) carry text-fallback evidence.`);
  }

  if (diagnostics.productCandidateImagesEnabled === false) {
    notes.push("Product candidate images were disabled for the visual sourcing attempt.");
  }

  return notes;
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
