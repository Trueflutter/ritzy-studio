import type { ProductMatchCandidate, RankedProductMatch, RoomProductRole } from "./product-matching";

// Anchored concepts: the hero pieces are chosen from real stock BEFORE the
// render, and the render is built around their photographs, so they match by
// construction instead of by search.
//
// The earlier product-first attempt failed in two ways that this module exists
// to prevent, and both are acceptance criteria:
//
//   1. Pieces the room could not use, and pieces that contradicted the brief.
//      Category, class, room scope and size are already settled by the sourcing
//      contracts before anything reaches here. What is settled HERE is the
//      brief: a room whose brief says "no beige, no warm brown" cannot be
//      anchored on a beige sofa, however well it scores on everything else.
//      For an anchor that is a hard filter, not a soft penalty, because the
//      anchor sets the palette of the whole render rather than sitting in it.
//
//   2. The same pieces in every design. A deterministic scorer returns its top
//      row every time, so one sofa anchored every living room. Three things fix
//      that here: pieces anchored recently are dropped, the shortlist is spread
//      across retailers and product families so it is not six variants of one
//      sofa, and the order is rotated by a per-room seed so two rooms with the
//      same brief do not start from the same candidate.

// The order anchors are chosen in, most visually load-bearing first. A room
// gets at most a handful, so this decides which ones.
const ANCHOR_WEIGHT: Record<string, number> = {
  sofas: 100,
  beds: 100,
  dining_tables: 80,
  armchairs: 70,
  rugs: 60,
  coffee_tables: 50,
  storage: 40,
  desks: 40,
  chairs: 30,
  lighting: 20
};

export const DEFAULT_ANCHOR_LIMIT = 4;

// The blueprint roles worth anchoring for a room: required ones only, heaviest
// first. Everything else is sourced after the render as it is today.
export function anchorRolesFromBlueprint(
  blueprint: ReadonlyArray<RoomProductRole>,
  { limit = DEFAULT_ANCHOR_LIMIT }: { limit?: number } = {}
): RoomProductRole[] {
  return blueprint
    .filter((role) => role.required && ANCHOR_WEIGHT[role.category] !== undefined)
    .slice()
    .sort((left, right) => (ANCHOR_WEIGHT[right.category] ?? 0) - (ANCHOR_WEIGHT[left.category] ?? 0))
    .slice(0, Math.max(0, limit));
}

function candidateColorText(candidate: ProductMatchCandidate) {
  return [candidate.color, candidate.material, ...candidate.colorTags, ...candidate.materialTags, candidate.name]
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase();
}

// A colour the brief asked to avoid, present in the piece the whole room will
// be built around. Soft-scoring this is how a "cool, no beige" brief ended up
// anchored on a beige sofa and a cognac armchair.
export function anchorContradictsBrief(candidate: ProductMatchCandidate, avoidColorTags: ReadonlyArray<string>): boolean {
  if (avoidColorTags.length === 0) {
    return false;
  }
  const text = candidateColorText(candidate);
  return avoidColorTags.some((tag) => {
    const token = tag.trim().toLowerCase();
    return token.length > 0 && new RegExp(`(?:^|[^a-z])${token}(?:[^a-z]|$)`).test(text);
  });
}

// Two products from the same retailer whose names start alike are usually the
// same piece in another colour. One per family keeps a shortlist a real choice.
export function productFamilyKey(candidate: ProductMatchCandidate): string {
  const words = candidate.name
    .toLowerCase()
    .replace(/[^a-z0-9\s]+/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .join(" ");
  return `${(candidate.retailerName ?? "").toLowerCase()}::${words}`;
}

// A stable number from a string, so the same room always rotates the same way
// while different rooms rotate differently. Deterministic on purpose: a random
// shuffle would make a run impossible to reproduce or to test.
export function rotationOffset(seed: string, length: number): number {
  if (length <= 0) {
    return 0;
  }
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % length;
}

export type AnchorShortlistInput<T extends RankedProductMatch> = {
  candidates: ReadonlyArray<T>;
  avoidColorTags?: ReadonlyArray<string>;
  // Products anchored recently, anywhere. Dropped outright: with thousands of
  // rows there is no reason to repeat, and repetition is what made every room
  // look the same.
  recentAnchorProductIds?: ReadonlyArray<string>;
  // Usually the room id. Rotates the order so two rooms with one brief differ.
  seed: string;
  size?: number;
};

export function anchorShortlist<T extends RankedProductMatch>({
  candidates,
  avoidColorTags = [],
  recentAnchorProductIds = [],
  seed,
  size = 6
}: AnchorShortlistInput<T>): T[] {
  const recent = new Set(recentAnchorProductIds);
  const eligible = candidates.filter(
    (candidate) => !recent.has(candidate.id) && !anchorContradictsBrief(candidate, avoidColorTags)
  );
  // If the brief and the recency window leave nothing, the brief wins: an
  // anchor that contradicts it is worse than no anchor, because the render is
  // built around it. Recency is the softer of the two, so it yields first.
  const pool = eligible.length > 0
    ? eligible
    : candidates.filter((candidate) => !anchorContradictsBrief(candidate, avoidColorTags));

  const families = new Set<string>();
  const spread: T[] = [];
  const overflow: T[] = [];
  for (const candidate of pool) {
    const family = productFamilyKey(candidate);
    if (families.has(family)) {
      overflow.push(candidate);
      continue;
    }
    families.add(family);
    spread.push(candidate);
  }
  const ordered = [...spread, ...overflow].slice(0, Math.max(1, size));
  const offset = rotationOffset(seed, ordered.length);
  return [...ordered.slice(offset), ...ordered.slice(0, offset)];
}

export type AnchorPick<T extends RankedProductMatch> = {
  role: RoomProductRole;
  product: T;
};

// The set used when the aesthetic pass cannot run: the head of each shortlist,
// with one retailer never allowed to supply the whole room.
export function anchorSetFromShortlists<T extends RankedProductMatch>(
  shortlists: ReadonlyArray<{ role: RoomProductRole; candidates: ReadonlyArray<T> }>
): AnchorPick<T>[] {
  const picks: AnchorPick<T>[] = [];
  const retailerCounts = new Map<string, number>();
  const maxPerRetailer = Math.max(1, Math.ceil(shortlists.length / 2));
  for (const { role, candidates } of shortlists) {
    const affordable = candidates.filter((candidate) => {
      const retailer = (candidate.retailerName ?? "").toLowerCase();
      return (retailerCounts.get(retailer) ?? 0) < maxPerRetailer;
    });
    const product = affordable[0] ?? candidates[0];
    if (!product) {
      continue;
    }
    const retailer = (product.retailerName ?? "").toLowerCase();
    retailerCounts.set(retailer, (retailerCounts.get(retailer) ?? 0) + 1);
    picks.push({ role, product });
  }
  return picks;
}

// What two anchor sets have in common, for the diversity criterion.
export function anchorSetSignature<T extends RankedProductMatch>(picks: ReadonlyArray<AnchorPick<T>>): string {
  return picks
    .map((pick) => pick.product.id)
    .slice()
    .sort()
    .join("|");
}
