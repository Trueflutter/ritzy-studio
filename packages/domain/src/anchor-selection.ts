import {
  BUDGET_TOLERANCE,
  avoidColorTokens,
  candidateColorFamilies,
  productFamilySignature
} from "./product-matching";
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
  // A study is built around its desk the way a bedroom is around its bed, so
  // the desk outranks the rug that would otherwise lead an office's anchors.
  desks: 80,
  storage: 40,
  side_tables: 35,
  chairs: 30
};
// Lighting is deliberately absent, on evidence. A table lamp anchored a harness
// bedroom and the render kept it at 0.30: a small object gives the image model
// little to preserve and the judge little to compare, so it spends an anchor
// slot on the piece least likely to survive the render. The room still gets its
// lamp from sourcing, on the list, checked like everything else.

export const DEFAULT_ANCHOR_LIMIT = 4;

// The roles worth anchoring for a room: the heaviest pieces its blueprint
// names, whether or not the blueprint marks them required. Weight is what
// matters here, because these are the pieces the RENDER is built around; a
// bedroom's rug carries more of its look than its bedside tables, and both are
// still sourced afterwards either way. Required wins a tie, so a room's
// must-have piece is never displaced by an optional one of equal weight.
export function anchorRolesFromBlueprint(
  blueprint: ReadonlyArray<RoomProductRole>,
  { limit = DEFAULT_ANCHOR_LIMIT }: { limit?: number } = {}
): RoomProductRole[] {
  return blueprint
    .filter((role) => ANCHOR_WEIGHT[role.category] !== undefined)
    .slice()
    .sort((left, right) => {
      const weight = (ANCHOR_WEIGHT[right.category] ?? 0) - (ANCHOR_WEIGHT[left.category] ?? 0);
      return weight !== 0 ? weight : Number(right.required) - Number(left.required);
    })
    .slice(0, Math.max(0, limit));
}

// The rotation seed for one role in one room. Rotating every role of a room by
// the same offset means two rooms whose offsets collide get an identical SET;
// qualifying by role decorrelates them, so a collision costs one piece rather
// than the whole scheme.
export function anchorSeedFor(roomSeed: string, roleCategory: string): string {
  return `${roomSeed}::${roleCategory}`;
}

function tokensOf(parts: ReadonlyArray<string | null | undefined>): string[] {
  return parts
    .filter((part): part is string => Boolean(part))
    .join(" ")
    .toLowerCase()
    .split(/[^a-z]+/)
    .filter(Boolean);
}

// A colour the brief asked to avoid, present in the piece the whole room will
// be built around. Soft-scoring this is how a "cool, no beige" brief ended up
// anchored on a beige sofa and a cognac armchair.
export function anchorContradictsBrief(candidate: ProductMatchCandidate, avoidColorTags: ReadonlyArray<string>): boolean {
  if (avoidColorTags.length === 0) {
    return false;
  }

  // Two reads, deliberately different, because widening both at once
  // over-rejects. Where the catalogue states a COLOUR, the shared vocabulary
  // applies, so "avoid beige" also catches a sand or oatmeal tag exactly as it
  // does in sourcing.
  const expanded = avoidColorTokens(avoidColorTags);
  if (tokensOf([candidate.color, ...candidate.colorTags]).some((token) => expanded.has(token))) {
    return true;
  }

  // The product's NAME and MATERIALS are read too, because a brown arrives
  // there as often as in a tag — "Stilo Armchair in Savoy Cognac Brown Leather"
  // was the piece that anchored a no-brown room in the prototype. But only the
  // literal words the brief used: colour families name materials ("linen",
  // "sand"), and expanding them here would read a linen-upholstered olive sofa
  // as beige.
  const literal = new Set(avoidColorTags.map((tag) => tag.trim().toLowerCase()).filter(Boolean));
  return tokensOf([candidate.material, ...candidate.materialTags, candidate.name]).some((token) =>
    literal.has(token)
  );
}

// Two products from the same retailer that are the same piece in another colour
// should not both take a shortlist slot. The judgement is the catalogue's, not
// this module's: productFamilySignature already strips colour, size and
// category nouns, so "Beige Cassia 3 Seater Sofa" and "Grey Cassia 3 Seater
// Sofa" are one family. A row whose name leaves nothing meaningful behind gets
// no family at all rather than sharing an empty one with every other such row.
export function productFamilyKey(candidate: ProductMatchCandidate): string {
  return productFamilySignature(candidate) || `unfamiliar::${candidate.id}`;
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

// A piece that answers the brief's own colour. Not a filter: a room needs a
// sofa even when the catalogue has no terracotta one, so this promotes rather
// than excludes, and it sits behind the contracts — nothing reaches a shortlist
// for its colour that the room's size, scope or object-kind rules would reject.
// The families a room falls back to on its own. A render defaults to these; it
// never defaults to a committed colour.
const NEUTRAL_FAMILIES = new Set(["white", "cream", "grey", "black", "brown"]);

export function onWantedPalette(
  candidate: ProductMatchCandidate,
  wantedColorFamilies: ReadonlyArray<string>
): boolean {
  if (wantedColorFamilies.length === 0) {
    return false;
  }
  // A brief that names a committed colour usually names its shell too — "a
  // committed terracotta and ochre accent, against a warm off-white shell".
  // Matching either makes every candidate on-palette and the promotion a
  // no-op, which is exactly what happened: nine rust rugs sat behind five
  // white ones for a brief that asked for a terracotta rug by name. So when a
  // brief names any colour a room would not arrive at by itself, THAT is the
  // one an anchor is promoted for. The shell needs no help; the render
  // produces it anyway.
  const committed = wantedColorFamilies.filter((family) => !NEUTRAL_FAMILIES.has(family));
  const target = committed.length > 0 ? committed : wantedColorFamilies;
  return candidateColorFamilies(candidate).some((family) => target.includes(family));
}

export type AnchorShortlistInput<T extends RankedProductMatch> = {
  candidates: ReadonlyArray<T>;
  avoidColorTags?: ReadonlyArray<string>;
  // The families the brief asks for. A candidate in one of them leads the
  // shortlist, so a room briefed for a committed colour is offered pieces that
  // can carry it rather than five neutrals that cannot.
  wantedColorFamilies?: ReadonlyArray<string>;
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
  wantedColorFamilies = [],
  recentAnchorProductIds = [],
  seed,
  size = 6
}: AnchorShortlistInput<T>): T[] {
  const recent = new Set(recentAnchorProductIds);
  const onBrief = candidates.filter((candidate) => !anchorContradictsBrief(candidate, avoidColorTags));
  const eligible = onBrief.filter((candidate) => !recent.has(candidate.id));
  // If the brief and the recency window leave nothing, the brief wins: an
  // anchor that contradicts it is worse than no anchor, because the render is
  // built around it. Recency is the softer of the two, so it yields first.
  const pool = eligible.length > 0 ? eligible : onBrief;

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
  // The brief's own colour is applied BEFORE the cut, not after it. Promoting
  // afterwards reordered five pieces that were already chosen, which is no help
  // when the piece that actually carries the brief sits at rank 19 of its
  // category: for a room briefed "a committed terracotta and ochre... carried
  // across upholstery, rug and art", every rug that could carry it was cut
  // before the promotion could see it.
  //
  // It still cannot bring in a piece the contracts, the brief's prohibitions or
  // the family spread have already removed. Colour decides the order of what
  // survives them, never what survives them.
  const ranked = [...spread, ...overflow];
  const shortlistSize = Math.max(1, size);

  // Colour RESERVES places in the shortlist; it does not take it over. Letting
  // every on-palette piece jump every better-ranked one put a rust 2.5-seater
  // with a left chaise into a hall — the right colour, and the one silhouette
  // the render has failed to reproduce in every run since this was measured —
  // and the room lost its dining zone with it. The aesthetic pass exists to
  // weigh colour against everything else; its job is to be SHOWN a piece that
  // carries the brief, not to be handed a shortlist that is only those.
  const reserved = shortlistSize >= 5 ? 2 : 1;
  const onPalette = ranked.filter((candidate) => onWantedPalette(candidate, wantedColorFamilies));
  const byRank = ranked.filter((candidate) => !onPalette.includes(candidate));
  const ordered =
    onPalette.length === 0
      ? ranked.slice(0, shortlistSize)
      : [
          ...onPalette.slice(0, reserved),
          ...byRank.slice(0, Math.max(0, shortlistSize - Math.min(reserved, onPalette.length))),
          // Only if the room has nothing else to offer.
          ...onPalette.slice(reserved)
        ].slice(0, shortlistSize);

  // Rotation still varies the order WITHIN the shortlist, so two rooms on one
  // brief are not handed the same set in the same order.
  const offset = rotationOffset(seed, ordered.length);
  return [...ordered.slice(offset), ...ordered.slice(0, offset)];
}

// Generic in the role, because this function never reads one: it carries the
// caller's role through to the pick. Blueprint roles and the richer sourcing
// spec roles both pass here, and neither should have to be flattened first.
export type AnchorPick<T extends RankedProductMatch, R = RoomProductRole> = {
  role: R;
  product: T;
};

// The set used when the aesthetic pass cannot run: the head of each shortlist,
// with one retailer never allowed to supply the whole room.
export function anchorSetFromShortlists<T extends RankedProductMatch, R>(
  shortlists: ReadonlyArray<{ role: R; candidates: ReadonlyArray<T> }>
): AnchorPick<T, R>[] {
  const picks: AnchorPick<T, R>[] = [];
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
