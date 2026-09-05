import assert from "node:assert/strict";

import type { DesignSpecObject } from "./design-spec";
import {
  fallbackCameraRead,
  parseViewPlan,
  planViews,
  PLANNED_VIEW_LABELS,
  plannedViewCaption,
  plannedViewLabel,
  specRoleMatchesFocal,
  type RoomCameraRead,
  type ViewPlanInput
} from "./view-planning";

// S4 step 1: the view planner is a pure function of facts. The camera read
// (a model) only reports what it saw; the rules here decide the set, and a
// rule is something a fixture can pin.

function object(role: string, label: string, extra: Partial<DesignSpecObject> = {}): DesignSpecObject {
  return { role, label, quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [], ...extra };
}

const livingSpec = {
  objects: [
    object("sofa", "three-seat curved sofa", { capacity: "seats 3" }),
    object("armchair", "accent armchair", { quantity: 2 }),
    object("coffee_table", "round coffee table"),
    object("area_rug", "large area rug"),
    object("floor_lamp", "arched floor lamp"),
    object("media_console", "low media console"),
    object("tv", "wall-mounted TV"),
    object("wall_art", "large abstract painting"),
    object("side_table", "small side table", { quantity: 2 }),
    object("throw_pillows", "throw pillows", { quantity: 4 }),
    object("curtains", "full-height curtains"),
    object("ac_unit", "split AC unit")
  ]
};

const hallSpec = {
  objects: [
    ...livingSpec.objects,
    object("dining_table", "oval dining table", { capacity: "seats 6" }),
    object("dining_chairs", "dining chairs", { quantity: 6 })
  ]
};

const bedroomSpec = {
  objects: [
    object("bed", "upholstered bed", { capacity: "king" }),
    object("nightstand", "walnut nightstand", { quantity: 2 }),
    object("table_lamp", "ceramic table lamp", { quantity: 2 }),
    object("rug", "wool rug"),
    object("dresser", "six-drawer dresser"),
    object("drapery", "linen drapery"),
    object("wall_art", "framed print")
  ]
};

const officeSpec = {
  objects: [
    object("desk", "walnut writing desk"),
    object("task_chair", "ergonomic task chair"),
    object("bookshelf", "open bookshelf"),
    object("task_lamp", "brass task lamp"),
    object("rug", "flatweave rug")
  ]
};

const photos = [{ assetId: "photo-1" }, { assetId: "photo-2" }, { assetId: "photo-3" }];

const products = [
  { itemId: "item-sofa", specKey: "0:sofa", category: "sofas", label: "three-seat curved sofa" },
  { itemId: "item-armchair", specKey: "1:armchair", category: "armchairs", label: "accent armchair" },
  { itemId: "item-coffee", specKey: "2:coffee_table", category: "coffee_tables", label: "round coffee table" },
  { itemId: "item-rug", specKey: "3:area_rug", category: "rugs", label: "large area rug" },
  { itemId: "item-lamp", specKey: "4:floor_lamp", category: "lighting", label: "arched floor lamp" },
  { itemId: "item-console", specKey: "5:media_console", category: "storage", label: "low media console" },
  { itemId: "item-art", specKey: "7:wall_art", category: "wall_art", label: "large abstract painting" },
  { itemId: "item-side", specKey: "8:side_table", category: "side_tables", label: "small side table" },
  { itemId: "item-pillows", specKey: "9:throw_pillows", category: "decor", label: "throw pillows" },
  { itemId: "item-curtains", specKey: "10:curtains", category: "curtains", label: "full-height curtains" }
];

function read(overrides: Partial<RoomCameraRead> & { hero?: Partial<RoomCameraRead["hero"]> }): RoomCameraRead {
  return {
    source: "vision",
    hero: { showsFocalElement: true, hiddenRoleKeys: [], ...(overrides.hero ?? {}) },
    photos: overrides.photos ?? []
  };
}

function input(overrides: Partial<ViewPlanInput>): ViewPlanInput {
  return {
    roomType: "Living Room",
    focalPoint: "tv_media_wall",
    spec: livingSpec,
    heroPhotoAssetId: "photo-1",
    photos,
    cameraRead: null,
    products,
    ...overrides
  };
}

// AC 1: the hero does not show the focal element; the eligible photo that
// faces the focal wall anchors a focal_wide view, and the focal token is in
// its mustShow. A photo of another room never anchors, however well it faces
// the wall.
{
  const plan = planViews(
    input({
      cameraRead: read({
        hero: { showsFocalElement: false, hiddenRoleKeys: ["5:media_console"] },
        photos: [
          { assetId: "photo-1", sameRoom: "yes", cameraRelativeToHero: "same", showsFocalWall: false },
          { assetId: "photo-3", sameRoom: "no", cameraRelativeToHero: "opposite", showsFocalWall: true },
          { assetId: "photo-2", sameRoom: "yes", cameraRelativeToHero: "opposite", showsFocalWall: true }
        ]
      })
    })
  );
  assert.equal(plan.views[0].key, "focal_wide");
  assert.equal(plan.views[0].sourcePhotoAssetId, "photo-2");
  assert.ok(plan.views[0].mustShow.includes("focal:tv_media_wall"));
  assert.ok(plan.views[0].mustShow.includes("5:media_console"), "a hidden large role rides with the wide view");
  assert.ok(plan.views[0].mustShowLabels.some((label) => /TV/.test(label)));
  assert.equal(plan.coverage.focalCoveredBy, "focal_wide");
  assert.ok(
    plan.views[0].photoNotes.some((note) => note.includes("photo-3") && /not the same room/.test(note)),
    "the wrong-room photo is recorded as passed over"
  );

  const unanchored = planViews(
    input({
      cameraRead: read({
        hero: { showsFocalElement: false, hiddenRoleKeys: [] },
        photos: [
          { assetId: "photo-1", sameRoom: "yes", cameraRelativeToHero: "same", showsFocalWall: false },
          { assetId: "photo-2", sameRoom: "unsure", cameraRelativeToHero: "opposite", showsFocalWall: true },
          { assetId: "photo-3", sameRoom: "yes", cameraRelativeToHero: "left", showsFocalWall: false }
        ]
      })
    })
  );
  assert.equal(unanchored.views[0].key, "focal_wide");
  assert.equal(unanchored.views[0].sourcePhotoAssetId, null, "an unsure photo is never an anchor");
  assert.ok(unanchored.views[0].photoNotes.some((note) => note.includes("photo-2")));
}

// AC 2: the hero shows the focal element; the wide view is the reverse angle,
// anchored to an opposite photo when one exists.
{
  const plan = planViews(
    input({
      cameraRead: read({
        photos: [
          { assetId: "photo-1", sameRoom: "yes", cameraRelativeToHero: "same", showsFocalWall: true },
          { assetId: "photo-2", sameRoom: "yes", cameraRelativeToHero: "opposite", showsFocalWall: false }
        ]
      })
    })
  );
  assert.equal(plan.views[0].key, "reverse_wide");
  assert.equal(plan.views[0].sourcePhotoAssetId, "photo-2");
  assert.equal(plan.coverage.focalCoveredBy, "hero");

  const noOpposite = planViews(
    input({
      cameraRead: read({
        photos: [
          { assetId: "photo-1", sameRoom: "yes", cameraRelativeToHero: "same", showsFocalWall: true },
          { assetId: "photo-2", sameRoom: "yes", cameraRelativeToHero: "left", showsFocalWall: false }
        ]
      })
    })
  );
  assert.equal(noOpposite.views[0].key, "reverse_wide");
  assert.equal(noOpposite.views[0].sourcePhotoAssetId, null);
}

// AC 3: a combined hall whose hero hides the dining zone assigns the dining
// roles to the wide view; a one-photo room anchors nothing; the coverage
// invariant holds over every fixture.
{
  const hall = planViews(
    input({
      roomType: "Living & Dining",
      spec: hallSpec,
      cameraRead: read({ hero: { showsFocalElement: true, hiddenRoleKeys: ["12:dining_table", "13:dining_chairs"] } })
    })
  );
  assert.equal(hall.views[0].key, "reverse_wide");
  assert.ok(hall.views[0].mustShow.includes("12:dining_table"));
  assert.ok(hall.views[0].mustShow.includes("13:dining_chairs"));

  const onePhoto = planViews(
    input({
      photos: [{ assetId: "photo-1" }],
      cameraRead: read({
        hero: { showsFocalElement: false, hiddenRoleKeys: [] },
        photos: [{ assetId: "photo-1", sameRoom: "yes", cameraRelativeToHero: "same", showsFocalWall: false }]
      })
    })
  );
  assert.ok(onePhoto.views.every((view) => view.sourcePhotoAssetId === null));

  const fixtures: ViewPlanInput[] = [
    input({ cameraRead: read({ hero: { showsFocalElement: false, hiddenRoleKeys: ["8:side_table", "4:floor_lamp"] } }) }),
    input({ cameraRead: read({ hero: { showsFocalElement: true, hiddenRoleKeys: ["7:wall_art"] } }) }),
    input({ roomType: "living room", cameraRead: read({ hero: { showsFocalElement: true, hiddenRoleKeys: [] } }) }),
    input({ roomType: "Family lounge", cameraRead: null }),
    input({
      roomType: "Bedroom",
      focalPoint: "bed_wall",
      spec: bedroomSpec,
      products: [],
      cameraRead: read({ hero: { showsFocalElement: true, hiddenRoleKeys: ["4:dresser", "2:table_lamp"] } })
    }),
    input({
      roomType: "Living & Dining",
      spec: hallSpec,
      cameraRead: read({ hero: { showsFocalElement: false, hiddenRoleKeys: ["12:dining_table"] } })
    }),
    input({
      roomType: "Home Office",
      focalPoint: "workstation",
      spec: officeSpec,
      products: [],
      cameraRead: read({ hero: { showsFocalElement: true, hiddenRoleKeys: ["3:task_lamp"] } })
    })
  ];
  for (const fixture of fixtures) {
    const plan = planViews(fixture);
    assert.ok(plan.views.length >= 1 && plan.views.length <= 2, `1 or 2 planned views, got ${plan.views.length}`);
    assert.equal(plan.views.length, 2, `every committed spec fixture yields two planned views (${fixture.roomType})`);
    for (const key of plan.coverage.keyRoleKeys) {
      const inHero = plan.coverage.heroCovers.includes(key);
      const inViews = plan.views.filter((view) => view.mustShow.includes(key)).length;
      assert.ok(
        (inHero && inViews === 0) || (!inHero && inViews === 1),
        `${key} must be covered by the hero or exactly one view (hero=${inHero}, views=${inViews})`
      );
    }
    assert.equal(plan.coverage.uncovered.length, 0, `nothing left uncovered in ${fixture.roomType}`);
    for (const view of plan.views) {
      if (view.key === "anchor_detail") {
        assert.equal(view.sourcePhotoAssetId, null, "the detail view is a crop, never photo-anchored");
      }
      assert.ok(view.referenceItemIds.length <= 6, `${view.key} carries at most six references`);
    }
    assert.ok(plan.heroReferenceItemIds.length <= 8);
  }
}

// AC 4: an unavailable read is conservative. With a known focal point the
// wide view is focal_wide whether or not the spec names a focal role; with an
// unknown focal point the set is the pre-S4 pair.
{
  const fallback = fallbackCameraRead(photos);
  assert.equal(fallback.source, "fallback");
  assert.equal(fallback.hero.showsFocalElement, null);

  const withTv = planViews(input({ cameraRead: fallback }));
  assert.deepEqual(
    withTv.views.map((view) => view.key),
    ["focal_wide", "anchor_detail"]
  );
  assert.equal(withTv.views[0].sourcePhotoAssetId, null, "a fallback read never anchors");

  const noRead = planViews(input({ cameraRead: null }));
  assert.equal(noRead.views[0].key, "focal_wide", "no read at all is the same as a fallback read");

  const withoutTv = planViews(
    input({
      cameraRead: fallback,
      spec: { objects: livingSpec.objects.filter((entry) => entry.role !== "tv" && entry.role !== "media_console") }
    })
  );
  assert.equal(withoutTv.views[0].key, "focal_wide");

  const unknownFocal = planViews(input({ focalPoint: "unknown", cameraRead: fallback }));
  assert.deepEqual(
    unknownFocal.views.map((view) => view.key),
    ["reverse_wide", "anchor_detail"]
  );
  assert.equal(unknownFocal.coverage.focalCoveredBy, null);
}

// References: the hero keeps the top eight by priority; the wide view carries
// its must-show products plus the primary seating for continuity; the detail
// view carries the small-scale pieces; tokens with no product are ignored.
{
  const twelve = [
    ...products,
    { itemId: "item-mirror", specKey: null, category: "mirrors", label: "arched mirror" },
    { itemId: "item-vase", specKey: null, category: "decor", label: "stone vase" }
  ];
  const plan = planViews(
    input({
      products: twelve,
      cameraRead: read({ hero: { showsFocalElement: false, hiddenRoleKeys: ["5:media_console", "8:side_table"] } })
    })
  );
  assert.equal(plan.heroReferenceItemIds.length, 8);
  const wide = plan.views[0];
  assert.ok(wide.referenceItemIds.includes("item-console"), "the wide view carries its hidden role's product");
  assert.ok(wide.referenceItemIds.includes("item-sofa"), "and the primary seating for continuity");
  assert.ok(!wide.referenceItemIds.includes("item-vase"));
  const detail = plan.views[1];
  assert.equal(detail.key, "anchor_detail");
  assert.ok(detail.referenceItemIds.includes("item-side"));
  assert.ok(detail.referenceItemIds.length <= 6);
}

// A spec without small-scale roles still gets a detail view when the selected
// products exceed the hero's reference cap; with neither it is a single wide.
{
  const sparse = { objects: [object("sofa", "sofa"), object("coffee_table", "coffee table"), object("tv", "TV")] };
  const single = planViews(
    input({ spec: sparse, products: products.slice(0, 2), cameraRead: read({ hero: { showsFocalElement: true, hiddenRoleKeys: [] } }) })
  );
  assert.deepEqual(single.views.map((view) => view.key), ["reverse_wide"]);
  const overflow = planViews(
    input({
      spec: sparse,
      products: [...products, { itemId: "item-x", specKey: null, category: "mirrors", label: "mirror" }],
      cameraRead: read({ hero: { showsFocalElement: true, hiddenRoleKeys: [] } })
    })
  );
  assert.deepEqual(overflow.views.map((view) => view.key), ["reverse_wide", "anchor_detail"]);
}

// Review fixes on the first increment. The focal view carries the selected
// focal products as references even when the read did not list them as
// hidden; a read-echoed id the room does not own never anchors; and a plan
// with the longest labels the spec allows still round-trips its schema.
{
  const plan = planViews(
    input({
      cameraRead: read({
        hero: { showsFocalElement: false, hiddenRoleKeys: [] },
        photos: [
          { assetId: "photo-1", sameRoom: "yes", cameraRelativeToHero: "same", showsFocalWall: false },
          { assetId: "ghost", sameRoom: "yes", cameraRelativeToHero: "opposite", showsFocalWall: true },
          { assetId: "photo-2", sameRoom: "yes", cameraRelativeToHero: "left", showsFocalWall: true }
        ]
      })
    })
  );
  assert.equal(plan.views[0].key, "focal_wide");
  assert.ok(plan.views[0].referenceItemIds.includes("item-console"), "the focal role's product rides with the focal view");
  assert.ok(!plan.views[0].mustShow.includes("5:media_console"), "but the hero still owns the role");
  assert.equal(plan.views[0].sourcePhotoAssetId, "photo-2", "a foreign id is never an anchor");
  assert.ok(plan.views[0].photoNotes.some((note) => note.startsWith("ghost:") && /not one of the room's photographs/.test(note)));

  const longest = "x".repeat(120);
  const longSpec = {
    objects: [
      object("tv", longest),
      object("media_console", longest),
      object("media_unit", longest),
      object("sofa", longest),
      object("side_table", longest)
    ]
  };
  const longPlan = planViews(
    input({
      spec: longSpec,
      products: [],
      cameraRead: read({ hero: { showsFocalElement: false, hiddenRoleKeys: ["3:sofa", "4:side_table"] } })
    })
  );
  assert.ok(longPlan.views.flatMap((view) => view.mustShowLabels).every((label) => label.length <= 160));
  assert.deepEqual(parseViewPlan(JSON.parse(JSON.stringify(longPlan))), longPlan, "the longest labels still round-trip");
}

// Focal vocabulary: raw spec roles, unsourceable ones included, so a TV counts.
assert.equal(specRoleMatchesFocal("tv", "tv_media_wall"), true);
assert.equal(specRoleMatchesFocal("media_console", "tv_media_wall"), true);
assert.equal(specRoleMatchesFocal("sofa", "tv_media_wall"), false);
assert.equal(specRoleMatchesFocal("bedside_table", "bed_wall"), false);
assert.equal(specRoleMatchesFocal("headboard", "bed_wall"), true);
assert.equal(specRoleMatchesFocal("writing_desk", "workstation"), true);

// The persisted plan round-trips through its schema; a malformed one is null.
{
  const plan = planViews(input({ cameraRead: read({}) }));
  const parsed = parseViewPlan(JSON.parse(JSON.stringify(plan)));
  assert.deepEqual(parsed, plan);
  assert.equal(parseViewPlan({ version: 2 }), null);
  assert.equal(parseViewPlan(null), null);
}

// One label table for both pages, with a fallback for keys no table knows.
assert.equal(PLANNED_VIEW_LABELS.focal_wide, plannedViewLabel("focal_wide"));
assert.equal(plannedViewLabel("something_else"), "Alternate angle");
assert.equal(plannedViewLabel(null), "Alternate angle");
assert.equal(plannedViewCaption("reverse_wide"), "From the other end of the room");
assert.equal(plannedViewCaption("nope"), "Another view");

console.log("view planning tests passed");
