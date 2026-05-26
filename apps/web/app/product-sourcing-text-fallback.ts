import type { SourceProductsFromConceptResult } from "@ritzy-studio/ai";
import {
  composeRoomProductOptions,
  type RankedProductMatch,
  type RoomProductRoleSpec
} from "@ritzy-studio/domain";

const TEXT_FALLBACK_PROMPT_KEY = "product_sourcing_text_fallback";
const TEXT_FALLBACK_PROMPT_VERSION = "2026-05-26.1";

export function buildProductSourcingTextFallbackResult({
  roomType,
  conceptTitle,
  conceptDescription,
  roles,
  rankedCandidates,
  model
}: {
  roomType: string;
  conceptTitle: string;
  conceptDescription?: string | null;
  roles: RoomProductRoleSpec[];
  rankedCandidates: RankedProductMatch[];
  model: string;
}): SourceProductsFromConceptResult {
  const roleOptions = composeRoomProductOptions({
    ranked: rankedCandidates,
    roles,
    optionsPerRole: 1
  });
  const optionsByCategory = new Map(roleOptions.map((role) => [role.category, role.options[0]]));
  const conceptContext = [conceptTitle, conceptDescription].filter(Boolean).join(" - ");
  const selectedProducts: SourceProductsFromConceptResult["selectedProducts"] = [];
  const roleResults: SourceProductsFromConceptResult["roleResults"] = [];
  const missingRoles: string[] = [];

  for (const role of roles) {
    const option = optionsByCategory.get(role.category);

    if (!option) {
      const missingRole = `${role.category} ${role.label}`;
      missingRoles.push(missingRole);
      roleResults.push({
        category: role.category,
        roleLabel: role.label,
        status: role.priority === "required" ? "missing_required" : "missing_supporting",
        productId: null,
        reason: `Text fallback could not find a ranked catalog candidate for ${role.label}.`
      });
      continue;
    }

    const reason = [
      "Selected by deterministic text fallback after product visual sourcing timed out.",
      `Approved concept: ${conceptContext}.`,
      option.selectionReason
    ]
      .filter(Boolean)
      .join(" ");

    selectedProducts.push({
      productId: option.id,
      category: role.category,
      roleLabel: role.label,
      quantity: role.quantity,
      matchStatus: "closest_available",
      visualMatchReason: reason,
      mismatchNote: "Selected without provider visual reasoning because the visual sourcing call timed out."
    });
    roleResults.push({
      category: role.category,
      roleLabel: role.label,
      status: "closest_available",
      productId: option.id,
      reason
    });
  }

  return {
    promptKey: TEXT_FALLBACK_PROMPT_KEY,
    promptVersion: TEXT_FALLBACK_PROMPT_VERSION,
    model,
    needs: roles.map((role) => ({
      category: role.category,
      roleLabel: role.label,
      visualBrief:
        role.visualBrief ??
        `Use ranked ${role.label} candidates for the approved ${roomType} concept: ${conceptContext}.`,
      quantity: role.quantity,
      priority: role.priority
    })),
    selectedProducts,
    roleResults,
    missingRoles
  };
}
