import { z } from "zod";

import type { DesignSpecObject } from "./design-spec";
import {
  buildRoleScopedCandidatePools,
  classTagsConflictWithRole,
  roleClassContractForRole,
  roleOptionKey,
  roomScopeConflictsWithRole,
  sizeClassConflictsWithRole,
  type ProductMatchCandidate,
  type ProductMatchRequest,
  type RoleProductOptions,
  type RoleScopedRankedProductMatch,
  type RoleSizeClass,
  type RoomProductRoleSpec
} from "./product-matching";

// S3: the confirmed design spec is the sourcing contract. Each purchasable spec
// object becomes a sourcing role with a canonical catalogue category and a HARD
// contract (category, class tags, room scope, lighting fixture class, seating
// silhouette, seat capacity, size class). A candidate that violates the
// contract can never be selected for that role, however well it scores; a role
// with no surviving candidate is reported as missing, never filled with the
// wrong thing. This is the mechanism behind the two Phase 0 failures the plan
// names (chandelier for a floor-lamp role, swing chair for a lounge chair).

export type SpecRoleFixtureClass = "floor_or_table" | "ceiling" | "wall";

// Catalogue categories are the strings products.category_normalized carries
// (the exported canonical list predates "sofas", which the scorer and the
// catalogue both use), so the contract speaks the same vocabulary as the rows.
export type SourcingCategory = string;

export type SpecRoleContract = {
  category: SourcingCategory;
  roomType: string;
  fixtureClass?: SpecRoleFixtureClass;
  // Seat range the spec asks for (from `capacity`), when it names one.
  minSeats?: number;
  maxSeats?: number;
  // Silhouette tokens that can never fill this seating role (unless the spec
  // itself asks for them, e.g. a rocking chair).
  excludedSilhouettes: string[];
};

export type SpecSourcingRole = RoomProductRoleSpec & {
  specKey: string;
  specObjectIndex: number;
  specRole: string;
  specLabel: string;
  contract: SpecRoleContract;
};

export type UnsourceableSpecObject = {
  specKey: string;
  specObjectIndex: number;
  kind: "built_in" | "no_catalogue_category";
  label: string;
  quantity: number;
  reason: string;
};

export type SpecContractRejection =
  | "category_mismatch"
  | "class_tag_conflict"
  | "room_scope_conflict"
  | "lighting_fixture_class_mismatch"
  | "silhouette_excluded"
  | "capacity_mismatch"
  | "size_class_mismatch";

export type SpecContractVerdict = { ok: true } | { ok: false; reason: SpecContractRejection };

// The jsonb contract of shopping_lists.missing_roles (migration M2): one entry
// per spec object the list does not carry, with the reason and what to do.
export const missingRoleEntrySchema = z.object({
  specKey: z.string().min(1).max(80),
  kind: z.enum(["missing", "built_in", "no_catalogue_category"]),
  label: z.string().min(1).max(200),
  category: z.string().min(1).max(60).nullable(),
  quantity: z.number().int().min(1).max(99),
  reason: z.string().min(1).max(400),
  guidance: z.string().min(1).max(400)
});

export const missingRolesSchema = z.array(missingRoleEntrySchema).max(60);

export type MissingRoleEntry = z.infer<typeof missingRoleEntrySchema>;

// Reads the jsonb column; a malformed value reads as "nothing recorded" so the
// screens never crash on a hand-edited row, and never invent entries either.
export function parseMissingRoles(value: unknown): MissingRoleEntry[] {
  const parsed = missingRolesSchema.safeParse(value);
  return parsed.success ? parsed.data : [];
}

export function missingRoleEntryForUnsourceable(entry: UnsourceableSpecObject): MissingRoleEntry {
  return {
    specKey: entry.specKey,
    kind: entry.kind,
    label: entry.label,
    category: null,
    quantity: entry.quantity,
    reason: entry.reason,
    guidance:
      entry.kind === "built_in"
        ? "Nothing to buy for this one."
        : "Source it directly from a retailer; the design keeps it."
  };
}

// ---------------------------------------------------------------- mapping

const ANCHOR_CATEGORIES = new Set<SourcingCategory>([
  "sofas",
  "armchairs",
  "beds",
  "headboards",
  "chairs",
  "dining_tables",
  "coffee_tables",
  "side_tables",
  "desks",
  "office_chairs",
  "storage",
  "lighting",
  "rugs"
]);

const BUILT_IN_PHRASES = [
  "recessed",
  "downlight",
  "spotlight",
  "track light",
  "cove light",
  "cove lighting",
  "led strip",
  "skylight",
  "fireplace",
  "built in",
  "ceiling fan",
  "radiator",
  "air conditioning",
  "ac unit",
  "flooring",
  "floor tiles",
  "wall panel",
  "panelling",
  "paneling",
  "wainscot",
  "cornice",
  "skirting",
  "curtain rail",
  "curtain track",
  "ceiling beam",
  "window frame",
  "door frame"
];

type CategoryRule = { category: SourcingCategory; phrases: string[] };

// Ordered: the first rule whose phrase appears in the text wins. Specific
// phrases (bedside table, dining chair, bedding) precede the generic nouns
// they contain (bed, chair) so they can never be swallowed by them.
const CATEGORY_RULES: CategoryRule[] = [
  {
    category: "side_tables",
    phrases: ["bedside", "nightstand", "night stand", "side table", "end table", "accent table", "occasional table", "console table", "lamp table", "hall table"]
  },
  { category: "coffee_tables", phrases: ["coffee table", "cocktail table", "centre table", "center table"] },
  { category: "dining_tables", phrases: ["dining table"] },
  { category: "desks", phrases: ["desk", "workstation", "writing table"] },
  { category: "office_chairs", phrases: ["office chair", "task chair", "desk chair"] },
  { category: "chairs", phrases: ["dining chair", "dining chairs", "dining seat"] },
  { category: "stools", phrases: ["bar stool", "counter stool", "stool", "ottoman", "pouf", "pouffe", "footstool", "bench"] },
  {
    category: "armchairs",
    phrases: ["armchair", "arm chair", "lounge chair", "accent chair", "occasional chair", "club chair", "wingback", "slipper chair", "reading chair", "swivel chair", "rocking chair", "chair"]
  },
  { category: "sofas", phrases: ["sofa", "sectional", "loveseat", "couch", "chaise", "settee", "daybed", "modular seating"] },
  { category: "headboards", phrases: ["headboard"] },
  {
    category: "bedding",
    phrases: ["bedding", "duvet", "bed linen", "bedsheet", "bed sheet", "quilt", "coverlet", "comforter", "bedspread", "pillowcase", "bed pillow"]
  },
  { category: "beds", phrases: ["bed frame", "bed"] },
  { category: "rugs", phrases: ["rug", "carpet", "runner"] },
  { category: "curtains", phrases: ["curtain", "drape", "drapery", "sheer", "blind", "blinds"] },
  { category: "mirrors", phrases: ["mirror"] },
  { category: "wall_art", phrases: ["wall art", "artwork", "art print", "painting", "canvas", "poster", "framed print", "gallery wall", "art"] },
  { category: "lighting", phrases: ["lamp", "pendant", "chandelier", "sconce", "lighting", "light", "lantern"] },
  {
    category: "storage",
    phrases: ["media console", "tv unit", "tv console", "tv stand", "media unit", "entertainment unit", "sideboard", "credenza", "buffet", "bookcase", "bookshelf", "shelving", "shelves", "shelf", "cabinet", "dresser", "chest of drawers", "chest", "wardrobe", "armoire", "display unit", "storage", "console", "bar cart", "trolley"]
  },
  {
    category: "decor",
    phrases: ["cushion", "throw", "pillow", "vase", "plant", "planter", "tray", "candle", "sculpture", "decor", "accessor", "basket", "bowl", "books", "greenery", "clock", "figurine", "ornament", "object"]
  },
  { category: "towels", phrases: ["towel"] }
];

function normalizeText(value: string) {
  return value.toLowerCase().replace(/_/g, " ").replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function hasPhrase(text: string, phrase: string) {
  return new RegExp(`(?:^|\\s)${phrase.replace(/\s+/g, "\\s+")}(?:s|es)?(?:\\s|$)`).test(text);
}

function categoryForText(text: string): SourcingCategory | null {
  for (const rule of CATEGORY_RULES) {
    if (rule.phrases.some((phrase) => hasPhrase(text, phrase))) {
      return rule.category;
    }
  }
  return null;
}

function isBuiltIn(text: string) {
  return BUILT_IN_PHRASES.some((phrase) => hasPhrase(text, phrase));
}

const NUMBER_WORDS: Record<string, number> = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  ten: 10,
  twelve: 12
};

function numberFromToken(token: string): number | null {
  if (/^\d+$/.test(token)) {
    return Number(token);
  }
  return NUMBER_WORDS[token] ?? null;
}

// "seats 6", "6 seater", "three-seat", "2-3 seater" -> a seat range.
export function parseSeatRange(value: string | null | undefined): { min: number; max: number } | null {
  if (!value) {
    return null;
  }
  const text = normalizeText(value);
  const range = text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|ten|twelve)\s*(?:to)?\s*(\d+|one|two|three|four|five|six|seven|eight|ten|twelve)\s*seat(?:er|s)?\b/);
  if (range) {
    const min = numberFromToken(range[1]);
    const max = numberFromToken(range[2]);
    if (min !== null && max !== null && min <= max) {
      return { min, max };
    }
  }
  const seatsN = text.match(/\bseats?\s+(?:up\s+to\s+)?(\d+|one|two|three|four|five|six|seven|eight|ten|twelve)\b/);
  const nSeater = text.match(/\b(\d+|one|two|three|four|five|six|seven|eight|ten|twelve)\s*seat(?:er|s)?\b/);
  const token = seatsN?.[1] ?? nSeater?.[1];
  const seats = token ? numberFromToken(token) : null;
  return seats !== null && seats > 0 ? { min: seats, max: seats } : null;
}

const LARGE_SOFA_PHRASES = ["sectional", "corner", "modular", "chaise", "l shaped", "u shaped"];

function sofaSizeClassForSpec(text: string, seats: { min: number; max: number } | null): RoleSizeClass {
  if (LARGE_SOFA_PHRASES.some((phrase) => hasPhrase(text, phrase)) || (seats && seats.min >= 4)) {
    return "large";
  }
  if (hasPhrase(text, "loveseat") || (seats && seats.max <= 2)) {
    return "compact";
  }
  return "standard";
}

const WALL_FIXTURE_PHRASES = ["sconce", "wall light", "wall lamp", "wall mounted light", "wall mounted lamp", "picture light"];
const CEILING_FIXTURE_PHRASES = ["pendant", "chandelier", "ceiling", "flush mount", "semi flush", "hanging", "suspension", "downlight", "recessed"];
const FLOOR_OR_TABLE_PHRASES = ["floor lamp", "table lamp", "desk lamp", "bedside lamp", "task lamp", "reading lamp", "floor light", "lamp"];

function fixtureClassForText(text: string): SpecRoleFixtureClass | undefined {
  if (WALL_FIXTURE_PHRASES.some((phrase) => hasPhrase(text, phrase))) {
    return "wall";
  }
  if (CEILING_FIXTURE_PHRASES.some((phrase) => hasPhrase(text, phrase))) {
    return "ceiling";
  }
  if (FLOOR_OR_TABLE_PHRASES.some((phrase) => hasPhrase(text, phrase))) {
    return "floor_or_table";
  }
  return undefined;
}

const SEATING_CATEGORIES = new Set<string>(["sofas", "armchairs", "chairs", "stools"]);
const SEATING_SILHOUETTE_EXCLUSIONS = [
  "swing",
  "rocking",
  "rocker",
  "hanging",
  "hammock",
  "egg chair",
  "gaming",
  "massage",
  "outdoor",
  "garden",
  "patio",
  "inflatable",
  "bean bag",
  "beanbag"
];

function visualBriefFor(object: DesignSpecObject) {
  return [object.label, object.sizeDescriptor, object.capacity, object.paletteMaterials.join(", ")]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join("; ");
}

export function sourcingRolesFromDesignSpec(
  spec: { objects: DesignSpecObject[] },
  roomType: string
): { roles: SpecSourcingRole[]; unsourceable: UnsourceableSpecObject[] } {
  const roles: SpecSourcingRole[] = [];
  const unsourceable: UnsourceableSpecObject[] = [];

  spec.objects.forEach((object, index) => {
    const roleText = normalizeText(object.role);
    const labelText = normalizeText(object.label);
    const combined = `${roleText} ${labelText}`;
    const specKey = `${index}:${roleText.replace(/\s+/g, "_") || "object"}`;

    if (isBuiltIn(combined)) {
      unsourceable.push({
        specKey,
        specObjectIndex: index,
        kind: "built_in",
        label: object.label,
        quantity: object.quantity,
        reason: "Built into the room; not a purchasable piece."
      });
      return;
    }

    // The role field is the extractor's clean noun ("pendant", "dining_table");
    // it decides first, so a label like "pendant over the dining table" can
    // never be read as a table. The label only decides when the role is vague.
    const category = categoryForText(roleText) ?? categoryForText(labelText);
    if (!category) {
      unsourceable.push({
        specKey,
        specObjectIndex: index,
        kind: "no_catalogue_category",
        label: object.label,
        quantity: object.quantity,
        reason: "The catalogue has no category for this piece yet."
      });
      return;
    }

    const seats = parseSeatRange(object.capacity) ?? parseSeatRange(object.label);
    const contract: SpecRoleContract = {
      category,
      roomType,
      fixtureClass: category === "lighting" ? fixtureClassForText(combined) : undefined,
      minSeats: seats?.min,
      maxSeats: seats?.max,
      excludedSilhouettes: SEATING_CATEGORIES.has(category)
        ? SEATING_SILHOUETTE_EXCLUSIONS.filter((phrase) => !hasPhrase(combined, phrase))
        : []
    };
    const baseRole: RoomProductRoleSpec = {
      category,
      label: object.label,
      visualBrief: visualBriefFor(object),
      quantity: object.quantity,
      priority: ANCHOR_CATEGORIES.has(category) ? "required" : "supporting",
      sizeClass: category === "sofas" ? sofaSizeClassForSpec(combined, seats) : undefined
    };
    const classContract = roleClassContractForRole(baseRole, roomType);
    roles.push({
      ...baseRole,
      allowedCategories: classContract.allowedCategories,
      roomScope: classContract.roomScope,
      roleKey: `${category}::${specKey}`,
      specKey,
      specObjectIndex: index,
      specRole: object.role,
      specLabel: object.label,
      contract
    });
  });

  return { roles, unsourceable };
}

// ---------------------------------------------------------------- contract

function candidateText(candidate: ProductMatchCandidate) {
  return normalizeText(
    [candidate.name, candidate.description, candidate.color, candidate.material, ...candidate.styleTags, ...candidate.roomTags]
      .filter((part): part is string => Boolean(part))
      .join(" ")
  );
}

// Seats a candidate offers: from its text, else (sofas only) from its width.
// Silence stays null: a contract can only reject what it can prove.
export function candidateSeatRange(candidate: ProductMatchCandidate): { min: number; max: number } | null {
  const fromText = parseSeatRange(`${candidate.name} ${candidate.description ?? ""}`);
  if (fromText) {
    return fromText;
  }
  if (candidate.categoryNormalized !== "sofas") {
    return null;
  }
  const width = candidate.dimensions?.widthCm ?? null;
  if (width === null) {
    return null;
  }
  if (width >= 210) {
    return { min: 3, max: 6 };
  }
  if (width >= 165) {
    return { min: 2, max: 3 };
  }
  return { min: 1, max: 2 };
}

export function checkCandidateAgainstSpecRole(
  candidate: ProductMatchCandidate,
  role: SpecSourcingRole
): SpecContractVerdict {
  const contract = roleClassContractForRole(role, role.contract.roomType);
  if (!candidate.categoryNormalized || !contract.allowedCategories.includes(candidate.categoryNormalized)) {
    return { ok: false, reason: "category_mismatch" };
  }
  if (classTagsConflictWithRole(candidate, contract)) {
    return { ok: false, reason: "class_tag_conflict" };
  }
  if (roomScopeConflictsWithRole(candidate, contract)) {
    return { ok: false, reason: "room_scope_conflict" };
  }

  const text = candidateText(candidate);

  if (role.contract.fixtureClass) {
    const candidateClass = fixtureClassForText(text);
    if (candidateClass && candidateClass !== role.contract.fixtureClass) {
      return { ok: false, reason: "lighting_fixture_class_mismatch" };
    }
  }

  if (role.contract.excludedSilhouettes.some((phrase) => hasPhrase(text, phrase))) {
    return { ok: false, reason: "silhouette_excluded" };
  }

  if (role.contract.minSeats !== undefined && role.contract.maxSeats !== undefined) {
    const seats = candidateSeatRange(candidate);
    if (seats && (seats.max < role.contract.minSeats || seats.min > role.contract.maxSeats)) {
      return { ok: false, reason: "capacity_mismatch" };
    }
  }

  if (sizeClassConflictsWithRole(candidate, contract)) {
    return { ok: false, reason: "size_class_mismatch" };
  }

  return { ok: true };
}

// ------------------------------------------------------------------ plan

export type SpecRolePool = {
  role: SpecSourcingRole;
  // Contract-clean, scorer-ranked candidates for this role.
  candidates: RoleScopedRankedProductMatch[];
  // Why the rest were left out (contract rejections plus the scorer's gates).
  rejectionReasons: Record<string, number>;
};

export type SpecSourcingPlan = {
  pools: SpecRolePool[];
  missing: MissingRoleEntry[];
};

const CATEGORY_NOUNS: Record<string, string> = {
  armchairs: "armchair",
  bedding: "bedding",
  beds: "bed",
  chairs: "chair",
  coffee_tables: "coffee table",
  curtains: "curtains",
  decor: "decor piece",
  desks: "desk",
  dining_tables: "dining table",
  headboards: "headboard",
  lighting: "light",
  mirrors: "mirror",
  office_chairs: "office chair",
  rugs: "rug",
  side_tables: "side table",
  sofas: "sofa",
  storage: "storage piece",
  stools: "stool",
  towels: "towel",
  wall_art: "artwork"
};

export function humanizeCategory(category: string): string {
  return CATEGORY_NOUNS[category] ?? category.replace(/_/g, " ");
}

export const MISSING_ROLE_GUIDANCE =
  "Try Refresh matches after the nightly catalogue update, or source this piece directly from a retailer.";

function fixtureNoun(fixtureClass: SpecRoleFixtureClass | undefined) {
  switch (fixtureClass) {
    case "ceiling":
      return "a ceiling fixture";
    case "wall":
      return "a wall light";
    case "floor_or_table":
      return "a floor or table lamp";
    default:
      return "a light";
  }
}

// Honest, user-facing reason for an unfilled role, from what the contract and
// the scorer rejected. No dollar signs, no internal identifiers.
export function missingRoleReason(
  role: SpecSourcingRole,
  rejectionReasons: Record<string, number>,
  contractCleanCount: number
): string {
  const noun = humanizeCategory(role.category);
  const [topReason] =
    Object.entries(rejectionReasons)
      .filter(([reason]) => reason !== "category_mismatch")
      .sort((left, right) => right[1] - left[1])[0] ?? [];

  if (contractCleanCount > 0) {
    return `No ${noun} in the catalogue fit the design's palette, budget and room size.`;
  }
  switch (topReason) {
    case "lighting_fixture_class_mismatch":
      return `Every lighting piece in the catalogue is the wrong kind of fixture for this role; the design asks for ${fixtureNoun(role.contract.fixtureClass)}.`;
    case "silhouette_excluded":
      return `The only ${noun} pieces left were swing, rocking or outdoor silhouettes, which the design does not ask for.`;
    case "capacity_mismatch": {
      const seats =
        role.contract.minSeats === role.contract.maxSeats
          ? `${role.contract.minSeats}`
          : `${role.contract.minSeats} to ${role.contract.maxSeats}`;
      return `No ${noun} matched the seat count the design asks for (seats ${seats}).`;
    }
    case "size_class_mismatch":
      return `No ${noun} matched the size the design asks for.`;
    case "class_tag_conflict":
    case "room_scope_conflict":
      return `The matching ${noun} pieces were made for another room or use.`;
    default:
      return `No ${noun} in the live catalogue matched this piece.`;
  }
}

export function missingRoleEntryForRole(
  role: SpecSourcingRole,
  rejectionReasons: Record<string, number>,
  contractCleanCount: number,
  reason = missingRoleReason(role, rejectionReasons, contractCleanCount)
): MissingRoleEntry {
  return {
    specKey: role.specKey,
    kind: "missing",
    label: role.specLabel,
    category: role.category,
    quantity: role.quantity,
    reason,
    guidance: MISSING_ROLE_GUIDANCE
  };
}

// Per-role retrieval through the existing scorer, with the spec contract
// applied BEFORE the pool's top-N cut: a floor lamp at rank thirteen behind
// twelve chandeliers must survive, so the contract filters the whole catalogue
// for the role and the scorer ranks what is left. Roles that end up empty are
// reported as missing with the reason the rejections tell.
export function buildSpecSourcingPlan({
  roles,
  unsourceable,
  candidates,
  roomType,
  conceptText,
  budgetMaxAed = null,
  roomMeasurements = null,
  recentlyUsedProductIds,
  avoidColorTags,
  candidatesPerRole = 12
}: {
  roles: SpecSourcingRole[];
  unsourceable: UnsourceableSpecObject[];
  candidates: ProductMatchCandidate[];
  roomType: string;
  conceptText: string;
  budgetMaxAed?: number | null;
  roomMeasurements?: ProductMatchRequest["roomMeasurements"];
  recentlyUsedProductIds?: string[];
  avoidColorTags?: string[];
  candidatesPerRole?: number;
}): SpecSourcingPlan {
  const pools: SpecRolePool[] = [];
  const missing: MissingRoleEntry[] = unsourceable.map(missingRoleEntryForUnsourceable);

  for (const role of roles) {
    const rejectionReasons: Record<string, number> = {};
    const clean = candidates.filter((candidate) => {
      const verdict = checkCandidateAgainstSpecRole(candidate, role);
      if (!verdict.ok) {
        rejectionReasons[verdict.reason] = (rejectionReasons[verdict.reason] ?? 0) + 1;
      }
      return verdict.ok;
    });
    const pool =
      clean.length > 0
        ? buildRoleScopedCandidatePools({
            roomType,
            conceptText,
            roles: [role],
            candidates: clean,
            budgetMaxAed,
            roomMeasurements,
            candidatesPerRole,
            recentlyUsedProductIds,
            avoidColorTags
          }).pools[0]
        : null;
    const reasons = { ...rejectionReasons, ...(pool?.rejectionReasons ?? {}) };
    if (pool && pool.candidates.length > 0) {
      pools.push({ role, candidates: pool.candidates, rejectionReasons: reasons });
    } else {
      missing.push(missingRoleEntryForRole(role, reasons, clean.length));
    }
  }

  return { pools, missing };
}

// Which candidates get an image in front of the visual pass: the top of every
// pool first (round-robin by rank), so a budget of N images covers every role
// before any role gets its second, and only candidates that have an image.
export function imageCandidateIdsForPools(
  pools: SpecRolePool[],
  { perRole, total }: { perRole: number; total: number }
): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (let rank = 0; rank < Math.max(0, perRole); rank += 1) {
    let any = false;
    for (const pool of pools) {
      const candidate = pool.candidates[rank];
      if (!candidate) {
        continue;
      }
      any = true;
      if (!candidate.primaryImageUrl || seen.has(candidate.id) || ids.length >= total) {
        continue;
      }
      seen.add(candidate.id);
      ids.push(candidate.id);
    }
    if (!any || ids.length >= total) {
      break;
    }
  }
  return ids;
}

// -------------------------------------------------------------- outcomes

export type SpecVisualRoleResult = {
  category: string;
  roleLabel: string;
  status: "strong_match" | "acceptable_match" | "closest_available" | "missing_required" | "missing_supporting";
  productId: string | null;
  reason: string;
};

export type SpecVisualSelection = {
  productId: string;
  category: string;
  roleLabel: string;
  matchStatus: "strong_match" | "acceptable_match" | "closest_available";
  visualMatchReason: string;
  mismatchNote: string | null;
};

export type SpecRoleOutcome =
  | {
      kind: "selected";
      role: SpecSourcingRole;
      pool: SpecRolePool;
      selectedProductId: string;
      matchStatus: SpecVisualSelection["matchStatus"];
      reason: string;
      mismatchNote: string | null;
    }
  | { kind: "missing"; role: SpecSourcingRole; entry: MissingRoleEntry };

function poolMatches(pool: SpecRolePool, category: string, roleLabel: string) {
  return (
    pool.role.category === category &&
    pool.role.label.trim().toLowerCase() === roleLabel.trim().toLowerCase()
  );
}

// The visual pass's verdict per role, held to the contract: a pick outside the
// role's contract-clean pool is never accepted, and a role the pass judged
// unmatched stays missing with the pass's own reason. The product that
// visibly belongs to the design wins; a wrong-looking product never does.
export function resolveSpecRoleOutcomes({
  pools,
  roleResults,
  selections
}: {
  pools: SpecRolePool[];
  roleResults: SpecVisualRoleResult[];
  selections: SpecVisualSelection[];
}): SpecRoleOutcome[] {
  return pools.map((pool) => {
    const result = roleResults.find((entry) => poolMatches(pool, entry.category, entry.roleLabel)) ?? null;
    const selection = selections.find((entry) => poolMatches(pool, entry.category, entry.roleLabel)) ?? null;
    const pickedId = result?.productId ?? selection?.productId ?? null;
    const picked = pickedId ? pool.candidates.find((candidate) => candidate.id === pickedId) : undefined;

    if (picked && result && (result.status === "missing_required" || result.status === "missing_supporting")) {
      // Contradictory verdict: a product named on a role declared missing.
      // The missing verdict is the honest one.
    } else if (picked) {
      return {
        kind: "selected",
        role: pool.role,
        pool,
        selectedProductId: picked.id,
        matchStatus:
          selection?.matchStatus ??
          (result?.status === "strong_match" || result?.status === "acceptable_match" ? result.status : "closest_available"),
        reason: selection?.visualMatchReason ?? result?.reason ?? "Chosen by the visual pass.",
        mismatchNote: selection?.mismatchNote ?? null
      };
    }

    const reason = result
      ? `The visual pass found no catalogue piece that matches the design: ${result.reason}`
      : "The visual pass returned no verdict for this piece.";
    return { kind: "missing", role: pool.role, entry: missingRoleEntryForRole(pool.role, pool.rejectionReasons, pool.candidates.length, reason) };
  });
}

// Deterministic outcomes for when the visual pass is unavailable (timeout or
// provider failure): the top contract-clean candidate per role, labelled
// honestly as chosen by ranking, never presented as a visual match.
export function resolveSpecRoleOutcomesByRanking(pools: SpecRolePool[], note: string): SpecRoleOutcome[] {
  return pools.map((pool) => ({
    kind: "selected",
    role: pool.role,
    pool,
    selectedProductId: pool.candidates[0].id,
    matchStatus: "closest_available",
    reason: "Chosen by catalogue ranking against the design spec.",
    mismatchNote: note
  }));
}

export function roleOptionsFromOutcomes(outcomes: SpecRoleOutcome[]): {
  roleOptions: RoleProductOptions[];
  selectedProductIdByRole: Map<string, string>;
  missing: MissingRoleEntry[];
} {
  const roleOptions: RoleProductOptions[] = [];
  const selectedProductIdByRole = new Map<string, string>();
  const missing: MissingRoleEntry[] = [];
  for (const outcome of outcomes) {
    if (outcome.kind === "missing") {
      missing.push(outcome.entry);
      continue;
    }
    const selected = outcome.pool.candidates.find((candidate) => candidate.id === outcome.selectedProductId);
    const options = selected
      ? [selected, ...outcome.pool.candidates.filter((candidate) => candidate.id !== selected.id)]
      : outcome.pool.candidates;
    const key = roleOptionKey(outcome.role);
    roleOptions.push({ ...outcome.role, options });
    selectedProductIdByRole.set(key, outcome.selectedProductId);
  }
  return { roleOptions, selectedProductIdByRole, missing };
}
