import type { SourceProductsFromConceptResult } from "@ritzy-studio/ai";
import {
  composeRoomProductOptions,
  type RankedProductMatch,
  type RoleProductOptions,
  type RoomProductRoleSpec
} from "@ritzy-studio/domain";

const TEXT_FALLBACK_PROMPT_KEY = "product_sourcing_text_fallback";
const TEXT_FALLBACK_PROMPT_VERSION = "2026-05-28.1";
const TEXT_FALLBACK_OPTIONS_PER_ROLE = 6;
const REQUIRED_TEXT_FALLBACK_ACCEPTABLE_SCORE = 70;

type TextFallbackMatchStatus = SourceProductsFromConceptResult["selectedProducts"][number]["matchStatus"];

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
    optionsPerRole: TEXT_FALLBACK_OPTIONS_PER_ROLE
  });
  const optionsByCategory = new Map(
    roleOptions.map((role) => [role.category, bestFallbackOptionForRole(role)])
  );
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

    const matchStatus = textFallbackMatchStatus({ option, role });
    const reason = [
      "Selected by deterministic text fallback after product visual sourcing timed out.",
      matchStatus === "acceptable_match"
        ? "Required role has an exact-category text-ranked candidate above the local/dev acceptable threshold."
        : null,
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
      matchStatus,
      visualMatchReason: reason,
      mismatchNote: "Selected without provider visual reasoning because the visual sourcing call timed out."
    });
    roleResults.push({
      category: role.category,
      roleLabel: role.label,
      status: matchStatus,
      productId: option.id,
      reason
    });
  }

  return {
    textCostUsd: 0,
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

function bestFallbackOptionForRole(role: RoleProductOptions) {
  if (role.priority === "required") {
    return role.options[0] ?? null;
  }

  const credibleOptions = role.options.filter((option) => isCredibleSupportFallbackOption(option, role));
  if (credibleOptions.length === 0) {
    return null;
  }

  return credibleOptions.sort(
    (left, right) =>
      supportFallbackFamilyScore(right, role) - supportFallbackFamilyScore(left, role) ||
      right.score - left.score
  )[0];
}

function textFallbackMatchStatus({
  option,
  role
}: {
  option: RankedProductMatch;
  role: RoomProductRoleSpec;
}): TextFallbackMatchStatus {
  if (
    role.priority === "required" &&
    option.categoryNormalized === role.category &&
    option.score >= REQUIRED_TEXT_FALLBACK_ACCEPTABLE_SCORE &&
    !option.selectionReason.toLowerCase().includes("role brief mismatch")
  ) {
    return "acceptable_match";
  }

  return "closest_available";
}

function isCredibleSupportFallbackOption(option: RankedProductMatch, role: RoleProductOptions) {
  const tokens = catalogueTokens(
    [
      option.name,
      option.color,
      option.material,
      option.description,
      option.styleTags.join(" "),
      option.colorTags.join(" "),
      option.materialTags.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
  );
  const effectivePrice = option.salePriceAed ?? option.priceAed;

  if (option.categoryNormalized !== role.category) {
    return false;
  }

  if (effectivePrice === 0) {
    return false;
  }

  if (role.category === "wall_art") {
    return (
      hasAnyToken(tokens, ["art", "artwork", "canvas", "framed", "painting", "print"]) &&
      !hasAnyToken(tokens, ["hook", "holder", "mail", "panel", "panels", "rack", "shelf", "shelves"])
    );
  }

  if (role.category === "decor") {
    return (
      hasAnyToken(tokens, ["bowl", "ceramic", "object", "planter", "tray", "vase", "vessel"]) &&
      !hasAnyToken(tokens, ["bench", "chair", "stool", "table"])
    );
  }

  if (role.category === "lighting") {
    return (
      (effectivePrice === null || effectivePrice >= 250) &&
      !hasAnyToken(tokens, ["chrome", "dna", "led", "novelty", "office", "spiral", "twisted"])
    );
  }

  if (role.category === "curtains") {
    return (
      hasAnyToken(tokens, ["curtain", "curtains", "drape", "drapes", "linen", "sheer", "textile", "voile"]) &&
      !hasAnyToken(tokens, ["shower"])
    );
  }

  if (role.category === "mirrors") {
    return hasAnyToken(tokens, ["mirror"]);
  }

  if (role.category === "side_tables") {
    return (
      hasAnyToken(tokens, ["accent", "end", "side"]) &&
      !hasAnyToken(tokens, ["bedside", "nightstand"])
    );
  }

  if (role.category === "storage") {
    return (
      hasAnyToken(tokens, ["console", "credenza", "media", "sideboard", "tv"]) &&
      !hasAnyToken(tokens, ["bookcase", "rack", "shelf", "shelves"])
    );
  }

  return true;
}

function supportFallbackFamilyScore(option: RankedProductMatch, role: RoleProductOptions) {
  const tokens = catalogueTokens(
    [
      option.name,
      option.color,
      option.material,
      option.description,
      option.styleTags.join(" "),
      option.colorTags.join(" "),
      option.materialTags.join(" ")
    ]
      .filter(Boolean)
      .join(" ")
  );
  let score = option.score;

  if (hasAnyToken(tokens, ["beige", "brass", "bronze", "cream", "gold", "ivory", "linen", "oak", "stone", "taupe", "travertine", "walnut", "wood"])) {
    score += 28;
  }

  if (hasAnyToken(tokens, ["black", "charcoal", "chrome", "graphite", "led", "office", "spiral", "twisted"])) {
    score -= 45;
  }

  if (role.category === "mirrors" && hasAnyToken(tokens, ["brass", "bronze", "gold", "wood"])) {
    score += 18;
  }

  if (role.category === "lighting" && hasAnyToken(tokens, ["brass", "bronze", "gold", "linen", "shade", "wood"])) {
    score += 18;
  }

  if (role.category === "decor" && hasAnyToken(tokens, ["ceramic", "planter", "tray", "vase", "vessel"])) {
    score += 18;
  }

  if (role.category === "curtains" && hasAnyToken(tokens, ["curtain", "drape", "linen", "sheer", "voile"])) {
    score += 18;
  }

  return score;
}

function catalogueTokens(value: string) {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .map((token) => token.trim())
      .filter(Boolean)
  );
}

function hasAnyToken(tokens: Set<string>, expected: string[]) {
  return expected.some((token) => tokens.has(token));
}
