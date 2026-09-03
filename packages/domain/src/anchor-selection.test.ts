import assert from "node:assert/strict";

import { enhancedProductRolesForRoom } from "./product-matching";
import type { ProductMatchCandidate, RankedProductMatch, RoomProductRole } from "./product-matching";
import { canonicalRoomTypes } from "./index";
import {
  DEFAULT_ANCHOR_LIMIT,
  anchorContradictsBrief,
  anchorSeedFor,
  anchorRoleBudgets,
  anchorRolesFromBlueprint,
  anchorSetFromShortlists,
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
    "required roles first, heaviest first"
  );
  assert.ok(roles.length <= DEFAULT_ANCHOR_LIMIT);
  assert.equal(anchorRolesFromBlueprint(blueprint, { limit: 2 }).length, 2);
  assert.ok(!roles.some((role) => role.category === "decor"), "decor never anchors a room");
  // Weight decides, not the required flag: an optional rug outranks a required
  // side table because the render is built around the heavier piece.

  // A room whose blueprint requires only one or two pieces is topped up from
  // its heaviest optional roles: a bedroom rendered from a bed alone is not an
  // anchored room, it is a bed.
  const bedroom: RoomProductRole[] = [
    { category: "beds", label: "bed", quantity: 1, required: true },
    { category: "side_tables", label: "bedside tables", quantity: 2, required: true },
    { category: "rugs", label: "rug", quantity: 1, required: false },
    { category: "lighting", label: "bedside lighting", quantity: 2, required: false },
    { category: "decor", label: "decor accent", quantity: 2, required: false }
  ];
  assert.deepEqual(
    anchorRolesFromBlueprint(bedroom).map((role) => role.category),
    ["beds", "rugs", "side_tables"],
    "the heaviest pieces the blueprint names, required or not, never decor"
  );

  // Lighting is not an anchor at all, on evidence: a table lamp anchored a
  // harness bedroom and the render kept it at 0.30. A small object gives the
  // image model little to preserve, so the slot is better spent or left empty.
  assert.ok(
    !anchorRolesFromBlueprint(bedroom).some((role) => role.category === "lighting"),
    "a bedside lamp is not what a room is built around"
  );
  assert.deepEqual(
    anchorRolesFromBlueprint([{ category: "lighting", label: "floor lamp", quantity: 1, required: true }]),
    [],
    "a blueprint of nothing but lighting anchors nothing, and the render runs free"
  );
}

// --- the avoid vocabulary is shared with sourcing, so a colour family added
// there reaches the anchor path too. Read over a wider text than sourcing uses,
// because a brown arrives in a name and a material as often as in a tag.
{
  const sandSofa = ranked({ id: "sand", name: "Dune 3-Seater Sofa", color: "Sand", colorTags: ["sand"] });
  const cognac = ranked({ id: "cognac2", name: "Stilo Armchair in Savoy Cognac Brown Leather", color: "Cognac", colorTags: [] });
  // "beige" is not the literal token on the product; the colour family is.
  assert.equal(anchorContradictsBrief(sandSofa, ["beige"]), true, "the family, not just the word");
  // And the wider text: this piece's brown is in its name and material only.
  assert.equal(anchorContradictsBrief(cognac, ["brown"]), true);
  assert.equal(anchorContradictsBrief(sandSofa, []), false);
  // But the families name MATERIALS as well as colours ("linen" sits in the
  // cream family), so expanding them over the name and material text would read
  // a linen-upholstered olive sofa as beige. The wider read matches only the
  // literal words the brief used.
  const oliveLinen = ranked({ id: "ol", name: "Osvaldo 3 Seater Sofa", color: "Olive", colorTags: ["olive"] });
  oliveLinen.material = "Linen";
  oliveLinen.materialTags = ["linen"];
  assert.equal(anchorContradictsBrief(oliveLinen, ["beige"]), false, "linen upholstery is not a beige sofa");
  // And the literal word still catches it where the catalogue writes it down.
  const brownNamed = ranked({ id: "bn", name: "Savoy Cognac Brown Leather Chair", color: "Cognac", colorTags: [] });
  assert.equal(anchorContradictsBrief(brownNamed, ["brown"]), true);
  assert.equal(anchorContradictsBrief(ranked({ id: "olive", name: "Osvaldo Sofa", color: "Olive", colorTags: ["olive"] }), ["beige"]), false);
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

  // Criterion 8b in full, and modelled the way production runs it: each role
  // draws from its OWN pool, and the rooms are generated in sequence with the
  // anchors of earlier rooms fed forward as recency. Rotating every role of a
  // room by one offset means two rooms whose offsets collide get an identical
  // scheme; qualifying the seed by role makes a collision cost one piece.
  //
  // The criterion is "five different sets AND no product anchoring more than
  // two of the five". Asserting only the first is weaker than the criterion and
  // passes on states the criterion calls a failure.
  const roleCategories = ["sofas", "armchairs", "rugs", "coffee_tables"];
  const poolFor = (category: string) =>
    [0, 1, 2, 3, 4, 5, 6, 7].map((index) =>
      ranked({
        id: `${category}-${index}`,
        name: `${category} Model${index}`,
        retailerName: `Retailer ${index % 3}`,
        score: 10 - index
      })
    );
  const pools = new Map(roleCategories.map((category) => [category, poolFor(category)]));

  const recent: string[] = [];
  const sets: string[] = [];
  const appearances = new Map<string, number>();
  for (const seed of seeds) {
    const set = roleCategories.map(
      (category) =>
        anchorShortlist({
          candidates: pools.get(category)!,
          recentAnchorProductIds: recent,
          seed: anchorSeedFor(seed, category)
        })[0].id
    );
    for (const id of set) {
      recent.push(id);
      appearances.set(id, (appearances.get(id) ?? 0) + 1);
    }
    sets.push(set.join("|"));
  }
  assert.equal(new Set(sets).size, seeds.length, "five rooms, one brief, five different schemes");
  const worst = Math.max(...appearances.values());
  assert.ok(worst <= 2, `no piece anchors more than two of the five rooms; worst was ${worst}`);
  // Not vacuous: the pools are small enough that a build without recency or
  // rotation would repeat, so the bound is doing work.
  assert.ok(appearances.size >= roleCategories.length * seeds.length - 4);

  const setFor = (seed: string) =>
    roleCategories.map((category) => anchorShortlist({ candidates, seed: anchorSeedFor(seed, category) })[0].id).join("|");
  assert.equal(setFor("room-1"), setFor("room-1"), "and the same room is still reproducible");
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

  // The colour word does not have to come first. The family key is the
  // catalogue's own signature, which strips colour, size and category nouns, so
  // a shortlist cannot fill up with one sofa in four colours however the
  // retailer happens to order the words.
  const colourFirst = [
    "Beige Cassia 3 Seater Sofa",
    "Grey Cassia 3 Seater Sofa",
    "Cassia 2 Seater Sofa - Ivory",
    "Nord 3 Seater Sofa - Grey"
  ].map((name, index) => ranked({ id: `c${index}`, name, retailerName: "One" }));
  assert.equal(new Set(colourFirst.slice(0, 3).map(productFamilyKey)).size, 1, "one Cassia, three colours");
  assert.notEqual(productFamilyKey(colourFirst[0]), productFamilyKey(colourFirst[3]));
  assert.equal(
    new Set(anchorShortlist({ candidates: colourFirst, seed: "room-1", size: 3 }).map(productFamilyKey)).size,
    2,
    "and the shortlist offers a real choice, not one piece four times"
  );

  // A name that leaves nothing meaningful behind gets its own family rather
  // than sharing an empty one with every other such row.
  const bare = ["Sofa", "Chair"].map((name, index) => ranked({ id: `b${index}`, name, retailerName: "One" }));
  assert.notEqual(productFamilyKey(bare[0]), productFamilyKey(bare[1]));

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
}

// --- rotation is stable and in range
{
  assert.equal(rotationOffset("room-1", 0), 0);
  for (const seed of ["a", "room-1", "9f2c"]) {
    const offset = rotationOffset(seed, 6);
    assert.ok(Number.isInteger(offset) && offset >= 0 && offset < 6);
  }
}

// --- Every room type the app can create is anchored on pieces that room can
// actually use. This is Ayo's first warning at its most dangerous: an anchor is
// not one bad row on a list, the render is BUILT around it, and the contracts
// do not catch a sofa in an office (room scope only constrains decor-ish
// categories, and an office-scoped role deliberately relaxes the desk and
// task-chair exclusions). Asserted per room type rather than on one fixture.
{
  const forbidden: Record<string, string[]> = {
    "Home Office": ["sofas", "beds", "dining_tables", "coffee_tables"],
    Bedroom: ["sofas", "dining_tables", "desks", "coffee_tables"],
    "Dining Room": ["beds", "sofas", "desks"],
    "Living Room": ["beds", "desks", "dining_tables"],
    "Living & Dining": ["beds", "desks"]
  };
  for (const roomType of canonicalRoomTypes) {
    const anchors = anchorRolesFromBlueprint(enhancedProductRolesForRoom(roomType)).map((role) => role.category);
    assert.ok(anchors.length > 0, `${roomType} anchors something`);
    for (const category of forbidden[roomType] ?? []) {
      assert.ok(
        !anchors.includes(category),
        `${roomType} must not be anchored on ${category}; got ${anchors.join(", ")}`
      );
    }
  }
  // And the room that exposed it gets what an office is actually built around.
  assert.deepEqual(
    anchorRolesFromBlueprint(enhancedProductRolesForRoom("Home Office")).map((role) => role.category),
    ["desks", "rugs", "storage"],
    "a study is built around its desk"
  );
}

// --- the SET has to fit the room, not just each piece the room. Four roles
// each priced at the whole budget can produce a render whose every hero piece
// the list then opens for cost: a picture the shopper approved with nothing in
// it chosen for them.
{
  const roles: RoomProductRole[] = [
    { category: "sofas", label: "sofa", quantity: 1, required: true },
    { category: "rugs", label: "rug", quantity: 1, required: true },
    { category: "coffee_tables", label: "coffee table", quantity: 1, required: true }
  ];
  const budgets = anchorRoleBudgets(roles, 20_000)!;
  // Shares are proportional to how much of the room each piece carries, so a
  // sofa is not priced out of a room its price should mostly buy.
  assert.ok(budgets.get("sofas")! > budgets.get("rugs")!);
  assert.ok(budgets.get("rugs")! > budgets.get("coffee_tables")!);
  // And the set as a whole stays inside its share of the room.
  const total = [...budgets.values()].reduce((sum, value) => sum + value, 0);
  assert.ok(total <= 20_000 * 0.6 + 0.001, `the anchor set's ceiling is a share of the room; got ${total}`);
  assert.equal(anchorRoleBudgets(roles, null), null, "a room with no budget caps nothing");

  // A piece above its role's share is not shortlisted at all: the render must
  // not be built around something the list will open.
  const cheap = ranked({ id: "cheap", name: "Nord Sofa Grey" });
  cheap.priceAed = 5_000;
  const dear = ranked({ id: "dear", name: "Grande Sofa Grey" });
  dear.priceAed = 40_000;
  assert.deepEqual(
    anchorShortlist({ candidates: [dear, cheap], maxLineTotalAed: 9_000, seed: "s" }).map((entry) => entry.id),
    ["cheap"]
  );
  // Quantity counts: two chairs at 5,000 are a 10,000 line.
  assert.deepEqual(
    anchorShortlist({ candidates: [cheap], maxLineTotalAed: 9_000, quantity: 2, seed: "s" }).map((entry) => entry.id),
    []
  );
  // Unlike recency, affordability does not yield: an unaffordable anchor is
  // worse than no anchor.
  assert.deepEqual(anchorShortlist({ candidates: [dear], maxLineTotalAed: 9_000, seed: "s" }), []);
}

console.log("anchor selection tests passed");
