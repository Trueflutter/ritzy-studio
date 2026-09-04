import assert from "node:assert/strict";

import { enhancedProductRolesForRoom, wantedColorFamilies } from "./product-matching";
import type { ProductMatchCandidate, RankedProductMatch, RoomProductRole } from "./product-matching";
import { canonicalRoomTypes } from "./index";
import {
  anchorUnderscaledForRole,
  DEFAULT_ANCHOR_LIMIT,
  anchorContradictsBrief,
  anchorSeedFor,
  anchorRolesFromBlueprint,
  anchorSetFromShortlists,
  anchorShortlist,
  onWantedPalette,
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

// --- price does not narrow what may anchor a room. An earlier version gave
// each role a weighted slice of the budget and refused anything above it, which
// priced a 20,000 AED room's sofa at about 4,300. Ayo: "I would never want to
// sacrifice quality for that." The room's figure still reaches these pools
// through the sourcing contracts, which compare a piece against the whole room.
{
  const dear = ranked({ id: "dear", name: "Grande Sofa Grey" });
  dear.priceAed = 18_000;
  const cheap = ranked({ id: "cheap", name: "Nord Sofa Slate" });
  cheap.priceAed = 3_000;
  assert.deepEqual(
    anchorShortlist({ candidates: [dear, cheap], seed: "s", size: 5 })
      .map((entry) => entry.id)
      .sort(),
    ["cheap", "dear"],
    "the expensive piece is still eligible to anchor"
  );
}

// --- the colour a brief ASKS FOR leads the shortlist. The contracts enforce
// what a brief forbids; nothing pulled toward what it wants, so a room briefed
// "a committed terracotta and ochre... carried across upholstery, rug and art"
// was offered five white rugs and the render faithfully built a neutral room.
{
  const rug = (id: string, name: string, color: string) => ranked({ id, name, color, colorTags: [color.toLowerCase()] });
  // Ranked order puts the neutrals first, as the catalogue's own scoring does.
  const candidates = [
    rug("w1", "Snow Rug Neutral", "White"),
    rug("w2", "Galeria Lux Rug", "White"),
    rug("w3", "Urbana Rug", "White"),
    rug("w4", "Mason Rug", "White"),
    rug("w5", "Charleen Rug", "White"),
    rug("r1", "Milas Carpet Ochre", "Ochre"),
    rug("r2", "Aleem Persian Rug", "Red")
  ];
  const wanted = wantedColorFamilies("a committed terracotta and ochre accent, against a warm off-white shell");
  assert.ok(wanted.includes("orange") && wanted.includes("yellow"), `the brief's colours are read: ${wanted.join(",")}`);

  const shortlist = anchorShortlist({ candidates, wantedColorFamilies: wanted, seed: "room-1", size: 5 });
  assert.ok(
    shortlist.some((entry) => entry.id === "r1" || entry.id === "r2"),
    `a piece that carries the brief reaches the shortlist; got ${shortlist.map((e) => e.id).join(",")}`
  );

  // The promotion happens BEFORE the cut. Applied after, it reorders five
  // pieces already chosen, which is no help when the piece that carries the
  // brief sits below them: every rug that could carry the terracotta was cut
  // before the promotion could see it.
  const deep = [...Array.from({ length: 12 }, (_, i) => rug(`n${i}`, `Neutral Rug ${i}`, "White")), rug("late", "Ochre Kilim", "Ochre")];
  const deepList = anchorShortlist({ candidates: deep, wantedColorFamilies: wanted, seed: "s", size: 5 });
  assert.ok(deepList.some((e) => e.id === "late"), "a piece ranked below the cut reaches the shortlist");

  // But colour RESERVES places, it does not take them. Letting every on-palette
  // piece jump every better-ranked one put a rust sofa with a left chaise into
  // a hall — right colour, and the one silhouette the render has never
  // reproduced — and the room lost its dining zone with it.
  const manyColoured = [
    ...Array.from({ length: 6 }, (_, i) => rug(`c${i}`, `Ochre Rug ${i}`, "Ochre")),
    ...Array.from({ length: 6 }, (_, i) => rug(`k${i}`, `Neutral Rug ${i}`, "White"))
  ];
  const mixed = anchorShortlist({ candidates: manyColoured, wantedColorFamilies: wanted, seed: "s", size: 5 });
  assert.equal(mixed.length, 5);
  assert.equal(
    mixed.filter((entry) => entry.id.startsWith("c")).length,
    2,
    `colour takes its reserved places and no more; got ${mixed.map((e) => e.id).join(",")}`
  );
  assert.ok(
    mixed.filter((entry) => entry.id.startsWith("k")).length === 3,
    "the best-ranked pieces keep the rest of the shortlist"
  );

  // The shell is not the accent. A brief naming both must not treat every
  // neutral as on-palette, or the promotion is a no-op — which is what left
  // nine rust rugs behind five white ones.
  assert.equal(onWantedPalette(rug("w9", "Snow Rug", "White"), wanted), false);
  assert.equal(onWantedPalette(rug("r9", "Ochre Rug", "Ochre"), wanted), true);

  // A brief that names only neutrals still gets them: the rule is "prefer the
  // colour a room would not arrive at by itself", not "prefer saturation".
  const neutralBrief = wantedColorFamilies("a calm scheme of warm greys and cream");
  assert.equal(onWantedPalette(rug("g1", "Slate Rug", "Grey"), neutralBrief), true);

  // And a brief with no colour at all promotes nothing.
  assert.equal(onWantedPalette(rug("x", "Any Rug", "Ochre"), wantedColorFamilies(null)), false);
}

console.log("anchor selection tests passed");

// Scale is a contract, not a preference. Round 2 of the 2026-09-04 measurement
// lost a 4-seater dining table in a hall briefed for ten and a 160x230 rug
// under a full seating group in a 5.2m x 4.2m room. Both were the colour the
// brief asked for; the render overruled both and anchors kept fell to 13/19.
{
  const table = (name: string) => ranked({ id: "t", name, categoryNormalized: "dining_tables" });
  const diningRole = { category: "dining_tables", label: "dining table" };

  assert.equal(
    anchorUnderscaledForRole(table("Elmont 4 seater Round Dining table"), diningRole, { diningSeatCount: 10 }),
    true,
    "a four-seater cannot anchor a hall the render is told to seat ten"
  );
  assert.equal(
    anchorUnderscaledForRole(table("Cooper 10 Seater Dining Table"), diningRole, { diningSeatCount: 10 }),
    false
  );
  assert.equal(
    anchorUnderscaledForRole(table("Dolores Ceramic Top Dining Table"), diningRole, { diningSeatCount: 10 }),
    false,
    "a table that does not state a seat count is judged elsewhere, not guessed at here"
  );
  assert.equal(
    anchorUnderscaledForRole(table("Elmont 4 seater Round Dining table"), diningRole, {}),
    false,
    "no stated seat count in the brief means no constraint to contradict"
  );

  const carpet = (name: string) => ranked({ id: "r", name, categoryNormalized: "rugs" });
  const generous = { category: "rugs", label: "generous rug" };
  const glassGlare = { measurements: { wallLengthCm: 520, roomDepthCm: 420 } };

  assert.equal(
    anchorUnderscaledForRole(carpet("Home Canvas Milas Carpet 45605A Yellow - 160X230"), generous, glassGlare),
    true,
    "a 160x230 rug cannot anchor a seating group in a 5.2m x 4.2m room"
  );
  assert.equal(
    anchorUnderscaledForRole(carpet("Bryn Dhurry 400X500CM"), generous, glassGlare),
    false
  );
  assert.equal(
    anchorUnderscaledForRole(carpet("Home Canvas Milas Carpet 45605A Yellow - 160X230"), generous, {
      measurements: { wallLengthCm: 380, roomDepthCm: 300 }
    }),
    false,
    "the same rug is fine in a small apartment; the floor scales with the room"
  );
  assert.equal(
    anchorUnderscaledForRole(carpet("Home Canvas Milas Carpet 45605A Yellow - 160X230"), generous, {}),
    false,
    "without the room's measurements there is nothing to be under-scaled against"
  );
  assert.equal(
    anchorUnderscaledForRole(carpet("Home Canvas Milas Carpet 45605A Yellow - 160X230"), { category: "rugs", label: "dining rug" }, glassGlare),
    false,
    "only the group-anchoring rug roles carry the floor"
  );
}
