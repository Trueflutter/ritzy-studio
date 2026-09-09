import assert from "node:assert/strict";

import {
  cameraReadContent,
  finalGroundedRenderReferences,
  finalRenderViewReferences,
  normalizeCameraRead,
  normalizeViewConsistency,
  spatialQaContext,
  viewConsistencyContent
} from ".";

// S4 step 2: the payloads of the two reads and the reference order of the
// generations, pinned without a provider. The prompt says "first image",
// "second image", "the last N images"; these are what make those sentences true.

// The camera read: hero first, then every photograph labelled by its asset id
// at low detail, and a JSON block with the focal element and the key roles.
{
  const content = cameraReadContent({
    roomType: "Living Room",
    focalPoint: "tv_media_wall",
    focalLabel: "the TV and media wall",
    heroImageDataUrl: "data:image/jpeg;base64,HERO",
    photos: [
      { assetId: "photo-2", dataUrl: "data:image/jpeg;base64,P2" },
      { assetId: "photo-3", dataUrl: "data:image/jpeg;base64,P3" }
    ],
    keyRoles: [
      { key: "0:sofa", label: "three-seat sofa" },
      { key: "5:media_console", label: "low media console" }
    ]
  });
  const texts = content.flatMap((part) => (part.type === "input_text" ? [part.text] : []));
  const images = content.flatMap((part) => (part.type === "input_image" ? [part] : []));
  assert.equal(images.length, 3);
  assert.ok(images.every((part) => part.detail === "low"), "facts are read at low detail");
  assert.ok(texts.some((text) => text.includes("Image 1") && /hero/i.test(text)));
  assert.ok(texts.some((text) => text.includes("photo-2")));
  assert.ok(texts.some((text) => text.includes("photo-3")));
  const json = JSON.parse(texts[0]);
  assert.equal(json.focalLabel, "the TV and media wall");
  assert.deepEqual(json.keyRoles.map((role: { key: string }) => role.key), ["0:sofa", "5:media_console"]);
  assert.deepEqual(json.photoAssetIds, ["photo-2", "photo-3"]);
}

// Normalisation: unknown asset ids and unknown role keys are dropped, a photo
// answered twice keeps its first answer, and a room with no focal element
// never claims the hero shows one.
{
  const read = normalizeCameraRead(
    {
      hero: { showsFocalElement: true, hiddenRoleKeys: ["5:media_console", "9:nope"] },
      photos: [
        { assetId: "photo-2", sameRoom: "yes", cameraRelativeToHero: "opposite", showsFocalWall: true },
        { assetId: "photo-2", sameRoom: "no", cameraRelativeToHero: "unknown", showsFocalWall: false },
        { assetId: "ghost", sameRoom: "yes", cameraRelativeToHero: "left", showsFocalWall: false }
      ]
    },
    { focalPoint: "tv_media_wall", photoAssetIds: ["photo-2", "photo-3"], roleKeys: ["0:sofa", "5:media_console"] }
  );
  assert.equal(read.source, "vision");
  assert.deepEqual(read.hero.hiddenRoleKeys, ["5:media_console"]);
  assert.equal(read.photos.length, 1);
  assert.equal(read.photos[0].sameRoom, "yes");

  const noFocal = normalizeCameraRead(
    { hero: { showsFocalElement: true, hiddenRoleKeys: [] }, photos: [] },
    { focalPoint: null, photoAssetIds: [], roleKeys: [] }
  );
  assert.equal(noFocal.hero.showsFocalElement, null);
}

// Spatial QA context: the reviewer is told where the focal element is.
{
  assert.match(
    spatialQaContext({ roomType: "living room", spatialIntent: { focalPoint: "tv_media_wall" }, cameraFacts: { focalElementInFrame: false, focalLabel: "the TV and media wall" } }),
    /NOT IN FRAME/
  );
  assert.match(
    spatialQaContext({ roomType: "living room", spatialIntent: { focalPoint: "tv_media_wall" }, cameraFacts: { focalElementInFrame: true, focalLabel: "the TV and media wall" } }),
    /IN FRAME/
  );
  assert.match(
    spatialQaContext({ roomType: "living room", spatialIntent: { focalPoint: "tv_media_wall" }, cameraFacts: { focalElementInFrame: null, focalLabel: null } }),
    /not known/i
  );
  assert.match(spatialQaContext({ roomType: "living room", spatialIntent: null, cameraFacts: null }), /Focal point was not specified/);
  // The assumed path (review finding): a brief that left the focal point
  // unknown, a design that carries a TV. The reviewer is told the assumption
  // and the framing, and never that the user chose it.
  const assumed = spatialQaContext({
    roomType: "living room",
    spatialIntent: { focalPoint: "unknown" },
    cameraFacts: { focalElementInFrame: false, focalLabel: "the TV and media wall" }
  });
  assert.match(assumed, /the design assumes the TV and media wall anchors the seating/);
  assert.match(assumed, /NOT IN FRAME/);
  assert.doesNotMatch(assumed, /The user chose/);
  assert.match(
    spatialQaContext({ roomType: "living room", spatialIntent: { focalPoint: "unknown" }, cameraFacts: { focalElementInFrame: null, focalLabel: null } }),
    /Focal point was not specified/
  );
}

// The view check: hero, view, then the anchored photograph when there is one;
// the expected and hidden labels travel in the JSON block as data.
{
  const anchored = viewConsistencyContent({
    roomType: "living room",
    viewKey: "focal_wide",
    heroImageDataUrl: "data:image/jpeg;base64,HERO",
    viewImageDataUrl: "data:image/jpeg;base64,VIEW",
    anchorPhotoDataUrl: "data:image/jpeg;base64,PHOTO",
    expectedLabels: ["the TV and media wall (wall-mounted TV)", "low media console"],
    hiddenLabels: ["low media console"],
    designLabels: ["wall-mounted TV", "crystal chandelier"],
    focalLabel: "the TV and media wall (wall-mounted TV)"
  });
  const images = anchored.flatMap((part) => (part.type === "input_image" ? [part] : []));
  assert.equal(images.length, 3);
  const texts = anchored.flatMap((part) => (part.type === "input_text" ? [part.text] : []));
  assert.ok(texts.some((text) => /Image 3/.test(text) && /photograph/i.test(text)));
  const json = JSON.parse(texts[0]);
  assert.deepEqual(json.expected, ["the TV and media wall (wall-mounted TV)", "low media console"]);
  assert.deepEqual(json.heroHidden, ["low media console"]);
  assert.deepEqual(json.design, ["wall-mounted TV", "crystal chandelier"], "the design vocabulary travels as data");

  const unanchored = viewConsistencyContent({
    roomType: "living room",
    viewKey: "reverse_wide",
    heroImageDataUrl: "data:image/jpeg;base64,HERO",
    viewImageDataUrl: "data:image/jpeg;base64,VIEW",
    anchorPhotoDataUrl: null,
    expectedLabels: [],
    hiddenLabels: [],
    designLabels: [],
    focalLabel: null
  });
  assert.equal(unanchored.filter((part) => part.type === "input_image").length, 2);
}

// A view with no anchored photograph cannot fail its camera comparison.
{
  const check = {
    architectureConsistent: true,
    cameraMatchesAnchor: "no" as const,
    sharedObjectsConsistent: true,
    expectedShown: [],
    expectedMissing: [],
    invented: [],
    verdict: "consistent" as const,
    issues: []
  };
  assert.equal(normalizeViewConsistency(check, { anchorPhotoDataUrl: null }).cameraMatchesAnchor, "not_applicable");
  assert.equal(normalizeViewConsistency(check, { anchorPhotoDataUrl: "data:image/jpeg;base64,P" }).cameraMatchesAnchor, "no");
}

// Reference order for a planned view: the anchored photograph first (when
// present), the hero second, the products last; the photograph and the hero
// are required so a URL provider must fail over rather than drop them.
{
  const photo = { bytes: Buffer.from("photo"), mimeType: "image/jpeg", url: "https://x.supabase.co/photo" };
  const hero = { bytes: Buffer.from("hero"), mimeType: "image/png", url: null };
  const products = [
    { name: "Sofa", roleLabel: "sofa", bytes: Buffer.from("p1"), mimeType: "image/jpeg", url: null },
    { name: "Lamp", roleLabel: "lamp", bytes: Buffer.from("p2"), mimeType: "image/jpeg", url: null }
  ];
  const anchored = finalRenderViewReferences({ sourcePhoto: photo, hero, productReferences: products });
  assert.deepEqual(
    anchored.map((reference) => [reference.name, reference.required ?? false]),
    [
      ["source-photo", true],
      ["final-render", true],
      ["product-1", false],
      ["product-2", false]
    ]
  );
  const unanchored = finalRenderViewReferences({ sourcePhoto: null, hero, productReferences: [] });
  assert.deepEqual(unanchored.map((reference) => reference.name), ["final-render"]);
}

// Reference order for the hero render: every photograph (the first is the
// camera), then the concept image, then at most eight products.
{
  const photo = (name: string) => ({ bytes: Buffer.from(name), mimeType: "image/jpeg", url: null });
  const references = finalGroundedRenderReferences({
    roomPhoto: photo("p1"),
    additionalRoomPhotos: [photo("p2"), photo("p3")],
    conceptImage: photo("concept"),
    products: Array.from({ length: 10 }, (_, index) => ({ ...photo(`product-${index}`), name: `Product ${index}` }))
  });
  assert.deepEqual(references.slice(0, 4).map((reference) => reference.name), ["room", "room-angle-2", "room-angle-3", "concept"]);
  assert.equal(references.filter((reference) => reference.name.startsWith("product-")).length, 8);
  assert.ok(references.slice(0, 4).every((reference) => reference.required));
}

console.log("render review payload tests passed");
