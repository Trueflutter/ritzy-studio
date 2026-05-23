import {
  catalogFirstBlueprintForRoom,
  type CatalogFirstRoomType,
  type ProductBundleItem,
  type ProductBundleTier,
  type RoomBundleRole
} from "./catalog-first-room-generation";
import { catalogFirstRolesToProductMatchingSpecs } from "./catalog-first-product-matching";

export type CatalogFirstRoomMeasurements = {
  wallLengthCm?: number | null;
  roomDepthCm?: number | null;
  ceilingHeightCm?: number | null;
};

export type CatalogFirstPlanExclusions = {
  productIds?: readonly string[];
  categories?: readonly string[];
  roleIds?: readonly string[];
};

export type CatalogFirstOrchestrationPlanInput = {
  roomType: string | CatalogFirstRoomType;
  roomMeasurements?: CatalogFirstRoomMeasurements | null;
  budgetTier: ProductBundleTier;
  candidates: readonly ProductBundleItem[];
  roles?: readonly RoomBundleRole[];
  exclusions?: CatalogFirstPlanExclusions;
};

export type CatalogFirstRolePlan = {
  role: RoomBundleRole;
  whyIncluded: string;
  quantityExpected: number;
  candidates: readonly ProductBundleItem[];
  selectedItem: ProductBundleItem | null;
  candidateCount: number;
  status: "selected" | "missing_required" | "weak_supporting";
  warnings: readonly string[];
};

export type CatalogFirstOrchestrationPlan = {
  roomType: CatalogFirstRoomType;
  budgetTier: ProductBundleTier;
  roomMeasurements: CatalogFirstRoomMeasurements | null;
  requiredRoles: readonly RoomBundleRole[];
  supportingRoles: readonly RoomBundleRole[];
  rolePlans: readonly CatalogFirstRolePlan[];
  productMatchingRoleSpecs: ReturnType<typeof catalogFirstRolesToProductMatchingSpecs>;
  missingRequiredRoles: readonly RoomBundleRole[];
  weakSupportingRoles: readonly RoomBundleRole[];
  quantityExpectations: Readonly<Record<string, number>>;
  estimatedTotalAed: number | null;
  confidence: {
    score: number;
    selectedRoleCount: number;
    totalRoleCount: number;
    requiredCoverage: number;
    supportingCoverage: number;
  };
  warnings: readonly string[];
};

export function planCatalogFirstRoomBundle(
  input: CatalogFirstOrchestrationPlanInput
): CatalogFirstOrchestrationPlan {
  const blueprint = catalogFirstBlueprintForRoom(input.roomType);
  const roles = input.roles ?? blueprint.roles;
  const validationWarnings = validateRoles(roles, blueprint.roomType);
  const exclusions = normalizedExclusions(input.exclusions);
  const roomMeasurements = input.roomMeasurements ?? null;
  const rolePlans = roles.map((role) =>
    planRole({
      role,
      candidates: input.candidates,
      budgetTier: input.budgetTier,
      exclusions
    })
  );
  const requiredRoles = roles.filter((role) => role.required);
  const supportingRoles = roles.filter((role) => !role.required);
  const missingRequiredRoles = rolePlans
    .filter((plan) => plan.status === "missing_required")
    .map((plan) => plan.role);
  const weakSupportingRoles = rolePlans
    .filter((plan) => plan.status === "weak_supporting")
    .map((plan) => plan.role);
  const selectedItems = rolePlans.flatMap((plan) => (plan.selectedItem ? [plan.selectedItem] : []));
  const estimatedTotalAed = selectedItems.every((item) => item.unitPriceAed !== null)
    ? selectedItems.reduce((total, item) => total + item.unitPriceAed! * item.quantity, 0)
    : null;
  const measurementWarnings = roomMeasurements ? ["room measurements captured but not used for fit scoring"] : [];

  return {
    roomType: blueprint.roomType,
    budgetTier: input.budgetTier,
    roomMeasurements,
    requiredRoles,
    supportingRoles,
    rolePlans,
    productMatchingRoleSpecs: catalogFirstRolesToProductMatchingSpecs(roles),
    missingRequiredRoles,
    weakSupportingRoles,
    quantityExpectations: Object.fromEntries(roles.map((role) => [role.id, role.quantity])),
    estimatedTotalAed,
    confidence: confidenceFor({ rolePlans, requiredRoles, supportingRoles }),
    warnings: [...validationWarnings, ...measurementWarnings]
  };
}

function planRole({
  role,
  candidates,
  budgetTier,
  exclusions
}: {
  role: RoomBundleRole;
  candidates: readonly ProductBundleItem[];
  budgetTier: ProductBundleTier;
  exclusions: {
    productIds: ReadonlySet<string>;
    categories: ReadonlySet<string>;
    roleIds: ReadonlySet<string>;
  };
}): CatalogFirstRolePlan {
  const roleExcluded = exclusions.roleIds.has(role.id);
  const roleCandidates = roleExcluded
    ? []
    : candidates
        .map((candidate, index) => ({ candidate, index }))
        .filter(({ candidate }) => role.acceptedCategories.includes(candidate.category))
        .filter(({ candidate }) => !exclusions.productIds.has(candidate.productId))
        .filter(({ candidate }) => !exclusions.categories.has(candidate.category))
        .sort((left, right) => compareCandidates(left, right, budgetTier))
        .map(({ candidate }) => candidate);
  const selected = roleCandidates[0] ?? null;
  const selectedItem = selected ? { ...selected, roleId: role.id, quantity: role.quantity } : null;
  const status = selectedItem ? "selected" : role.required ? "missing_required" : "weak_supporting";
  const warnings = [
    roleExcluded ? "role excluded by user" : null,
    !selectedItem && role.required ? "required role has no acceptable catalog candidate" : null,
    !selectedItem && !role.required ? "supporting role has no acceptable catalog candidate" : null
  ].filter((warning): warning is string => Boolean(warning));

  return {
    role,
    whyIncluded: `${role.includeWhen} ${role.importance} role from catalog-first ${role.roomType} blueprint`,
    quantityExpected: role.quantity,
    candidates: roleCandidates,
    selectedItem,
    candidateCount: roleCandidates.length,
    status,
    warnings
  };
}

function compareCandidates(
  left: { candidate: ProductBundleItem; index: number },
  right: { candidate: ProductBundleItem; index: number },
  budgetTier: ProductBundleTier
) {
  const leftPriced = left.candidate.unitPriceAed !== null;
  const rightPriced = right.candidate.unitPriceAed !== null;

  if (leftPriced !== rightPriced) {
    return leftPriced ? -1 : 1;
  }

  if (budgetTier === "budget") {
    const priceDelta = (left.candidate.unitPriceAed ?? 0) - (right.candidate.unitPriceAed ?? 0);
    if (priceDelta !== 0) {
      return priceDelta;
    }

    const scoreDelta = (right.candidate.matchScore ?? -1) - (left.candidate.matchScore ?? -1);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }
  } else {
    const scoreDelta = (right.candidate.matchScore ?? -1) - (left.candidate.matchScore ?? -1);
    if (scoreDelta !== 0) {
      return scoreDelta;
    }

    const priceDelta = (right.candidate.unitPriceAed ?? 0) - (left.candidate.unitPriceAed ?? 0);
    if (priceDelta !== 0) {
      return priceDelta;
    }
  }

  return left.candidate.productId.localeCompare(right.candidate.productId) || left.index - right.index;
}

function confidenceFor({
  rolePlans,
  requiredRoles,
  supportingRoles
}: {
  rolePlans: readonly CatalogFirstRolePlan[];
  requiredRoles: readonly RoomBundleRole[];
  supportingRoles: readonly RoomBundleRole[];
}) {
  const selectedRoleCount = rolePlans.filter((plan) => plan.selectedItem).length;
  const requiredSelectedCount = rolePlans.filter((plan) => plan.role.required && plan.selectedItem).length;
  const supportingSelectedCount = rolePlans.filter((plan) => !plan.role.required && plan.selectedItem).length;
  const requiredCoverage = requiredRoles.length === 0 ? 100 : Math.round((requiredSelectedCount / requiredRoles.length) * 100);
  const supportingCoverage =
    supportingRoles.length === 0 ? 100 : Math.round((supportingSelectedCount / supportingRoles.length) * 100);

  return {
    score: Math.round(requiredCoverage * 0.75 + supportingCoverage * 0.25),
    selectedRoleCount,
    totalRoleCount: rolePlans.length,
    requiredCoverage,
    supportingCoverage
  };
}

function normalizedExclusions(exclusions: CatalogFirstPlanExclusions | undefined) {
  return {
    productIds: new Set(exclusions?.productIds ?? []),
    categories: new Set(exclusions?.categories ?? []),
    roleIds: new Set(exclusions?.roleIds ?? [])
  };
}

function validateRoles(roles: readonly RoomBundleRole[], roomType: CatalogFirstRoomType) {
  const warnings: string[] = [];
  const seenRoleIds = new Set<string>();

  for (const role of roles) {
    if (seenRoleIds.has(role.id)) {
      warnings.push(`duplicate role id: ${role.id}`);
    }
    seenRoleIds.add(role.id);

    if (role.roomType !== roomType) {
      warnings.push(`role ${role.id} belongs to ${role.roomType}, not ${roomType}`);
    }

    if (role.acceptedCategories.length === 0) {
      warnings.push(`role ${role.id} has no accepted categories`);
    }

    if (role.quantity <= 0) {
      warnings.push(`role ${role.id} has non-positive quantity`);
    }
  }

  return warnings;
}
