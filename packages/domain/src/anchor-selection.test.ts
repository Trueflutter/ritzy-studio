import assert from "node:assert/strict";

import type { ProductMatchCandidate, RankedProductMatch, RoomProductRole } from "./product-matching";
import {
  DEFAULT_ANCHOR_LIMIT,
  anchorContradictsBrief,
  anchorRolesFromBlueprint,
  anchorSetFromShortlists,
  anchorSetSignature,
  anchorShortlist,
  productFamilyKey,
  rotationOffset
} from "./anchor-selection";

// The two failures of the earlier product-first attempt, in Ayo's words:
// pieces the room could not use, and the same pieces in every design. Both are
// acceptance criteria for anchored concepts, so both are pinned here. The
// products below are the ones the prototype actually picked for a room whose
// brief said cool, no beige and no warm brown.

const base: ProductMatchCandidate = {
  id: "p0",
  name: "Product",
  retailerName: "Home Centre",
  canonicalUrl: "https://example.com/p",
  description: null,
  categoryNormalized: "sofas",
  priceAed: 1000,
  salePriceAed: null,
  availability: "in stock",
  primaryImageUrl: "https://example.com/p.jpg",
  color: null,
  material: null,
  styleTags: [],
  colorTags: [],
  materialTags: [],
  roomTags: [],
  lastCheckedAt: null,
  dimensions: null
};
const ranked = (overrides: Partial<RankedProductMatch> & { id: string }): RankedProductMatch => ({
  ...base,
  score: 1,
  selectionReason: "",
  dimensionFitNote: null,
  warnings: [],
  ...overrides
});

// --- which roles get anchored
{
  const blueprint: RoomProductRole[] = [
    { category: "sofas", label: "anchor seating", quantity: 1, required: true },
    { category: "armchairs", label: "accent chairs", quantity: 2, required: true },
    { category: "coffee_tables", label: "coffee table", quantity: 1, required: true },
    { category: "rugs", label: "rug", quantity: 1, required: true },
    { category: "lighting", label: "lighting", quantity: 1, required: false },
    { category: "decor", label: "decor accent", quantity: 2, required: false }
  ];
  const roles = anchorRolesFromBlueprint(blueprint);
  assert.deepEqual(
    roles.map((role) => role.category),
    ["sofas", "armchairs", "rugs", "coffee_tables"],
    "required roles only, heaviest first"
  );
  assert.ok(roles.length <= DEFAULT_ANCHOR_LIMIT);
  assert.equal(anchorRolesFromBlueprint(blueprint, { limit: 2 }).length, 2);
  // A role the room does not require is never an anchor, however cheap it is
  // to source: anchors set the palette of the whole render.
  assert.ok(!roles.some((role) => role.category === "decor" || role.category === "lighting"));
}

// --- warning 1: the brief is a hard filter for an anchor
{
  const beigeSofa = ranked({ id: "beige", name: "Rio 4-Seater Sofa with Wide Armrest – Beige | Fabric & Wood Frame", color: "Beige" });
  const cognacChair = ranked({ id: "cognac", name: "Stilo Armchair in Savoy Cognac Brown Leather", color: "Brown", colorTags: ["brown"] });
  const greySofa = ranked({ id: "grey", name: "Nord 3-Seater Sofa – Slate Grey", color: "Grey", colorTags: ["grey"] });
  const avoid = ["beige", "brown"];

  assert.equal(anchorContradictsBrief(beigeSofa, avoid), true, "a beige sofa cannot anchor a no-beige brief");
  assert.equal(anchorContradictsBrief(cognacChair, avoid), true);
  assert.equal(anchorContradictsBrief(greySofa, avoid), false);
  assert.equal(anchorContradictsBrief(beigeSofa, []), false, "a brief that names nothing forbids nothing");
  // Whole words only: "brownstone" is not brown.
  assert.equal(anchorContradictsBrief(ranked({ id: "x", name: "Brownstone Loft Sofa" }), ["brown"]), false);

  const shortlist = anchorShortlist({ candidates: [beigeSofa, cognacChair, greySofa], avoidColorTags: avoid, seed: "room-1" });
  assert.deepEqual(shortlist.map((entry) => entry.id), ["grey"], "the off-brief pieces never reach the shortlist");
}

// --- warning 2: not the same pieces every time
{
  const candidates = ["a", "b", "c", "d", "e", "f"].map((id, index) =>
    ranked({ id, name: `Sofa ${id}`, retailerName: `Retailer ${index % 3}`, score: 10 - index })
  );

  // A piece anchored recently is dropped outright.
  const withoutRecent = anchorShortlist({ candidates, recentAnchorProductIds: ["a", "b"], seed: "room-1" });
  assert.ok(!withoutRecent.some((entry) => entry.id === "a" || entry.id === "b"));

  // Different rooms, same brief and same catalogue, start from different pieces.
  const seeds = ["room-1", "room-2", "room-3", "room-4", "room-5"];
  const heads = seeds.map((seed) => anchorShortlist({ candidates, seed })[0].id);
  assert.ok(new Set(heads).size > 1, "five rooms do not all start from the same product");
  // And the same room is stable, so a run can be reproduced.
  assert.equal(anchorShortlist({ candidates, seed: "room-1" })[0].id, anchorShortlist({ candidates, seed: "room-1" })[0].id);

  // A shortlist is a real choice, not one piece in six colours.
  const family = ["Milo Sofa Beige", "Milo Sofa Grey", "Milo Sofa Green", "Kova Sofa Grey"].map((name, index) =>
    ranked({ id: `f${index}`, name, retailerName: "Home Centre" })
  );
  assert.equal(productFamilyKey(family[0]), productFamilyKey(family[1]), "same retailer, same first words, same family");
  assert.notEqual(productFamilyKey(family[0]), productFamilyKey(family[3]));
  const spread = anchorShortlist({ candidates: family, seed: "room-1", size: 2 });
  assert.equal(new Set(spread.map(productFamilyKey)).size, 2, "one piece per family before repeats");

  // The brief still wins when recency would empty the shortlist.
  const onlyOne = [ranked({ id: "only", name: "Nord Sofa Grey" })];
  assert.deepEqual(
    anchorShortlist({ candidates: onlyOne, recentAnchorProductIds: ["only"], seed: "s" }).map((entry) => entry.id),
    ["only"],
    "recency yields rather than leaving the room unanchored"
  );
  assert.deepEqual(
    anchorShortlist({ candidates: onlyOne, avoidColorTags: ["grey"], seed: "s" }).map((entry) => entry.id),
    [],
    "but an off-brief piece is never anchored, even as the last one standing"
  );
}

// --- the fallback set: no single retailer furnishes the whole room
{
  const role = (category: string): RoomProductRole => ({ category, label: category, quantity: 1, required: true });
  const fromOne = (prefix: string) =>
    [0, 1].map((index) => ranked({ id: `${prefix}${index}`, retailerName: index === 0 ? "Big Retailer" : "Other Retailer" }));
  const picks = anchorSetFromShortlists([
    { role: role("sofas"), candidates: fromOne("s") },
    { role: role("armchairs"), candidates: fromOne("a") },
    { role: role("rugs"), candidates: fromOne("r") },
    { role: role("coffee_tables"), candidates: fromOne("c") }
  ]);
  assert.equal(picks.length, 4);
  const retailers = picks.map((pick) => pick.product.retailerName);
  assert.ok(retailers.filter((name) => name === "Big Retailer").length <= 2, "one retailer cannot supply the whole room");
  assert.equal(anchorSetSignature(picks), anchorSetSignature([...picks].reverse()), "the signature is order-free");
}

// --- rotation is stable and in range
{
  assert.equal(rotationOffset("room-1", 0), 0);
  for (const seed of ["a", "room-1", "9f2c"]) {
    const offset = rotationOffset(seed, 6);
    assert.ok(Number.isInteger(offset) && offset >= 0 && offset < 6);
  }
}

console.log("anchor selection tests passed");
