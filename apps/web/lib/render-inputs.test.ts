import assert from "node:assert/strict";

import { loadFinalRenderInputs } from "./render-inputs";
import { fakeSupabase, type RecordedCall } from "./services/supabase-test-double";

// S4 step 4 (AC 8, loader half): the hero render is fed every photograph of
// the room in created_at order, the confirmed spec's preservation list, and
// the selected products in render priority order.

async function main() {
  const photos = [
    { id: "photo-1", storage_path: "u/room-1/p1.jpg", mime_type: "image/jpeg", created_at: "2026-09-01T10:00:00Z" },
    { id: "photo-2", storage_path: "u/room-1/p2.jpg", mime_type: "image/jpeg", created_at: "2026-09-01T10:01:00Z" },
    { id: "photo-3", storage_path: "u/room-1/p3.jpg", mime_type: "image/jpeg", created_at: "2026-09-01T10:02:00Z" }
  ];
  const specRow = {
    id: "spec-1",
    room_id: "room-1",
    concept_id: "concept-1",
    status: "confirmed",
    objects: [
      { role: "sofa", label: "three-seat sofa", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
      { role: "tv", label: "wall-mounted TV", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] }
    ],
    must_preserve: ["the sliding doors to the garden", "the tray ceiling"]
  };
  const product = (id: string, category: string, name: string) => ({
    id,
    name,
    description: null,
    primary_image_url: `https://cdn.example.com/${id}.jpg`,
    retailer: { name: "Home Centre", status: "active" },
    dimensions: [{ width_cm: 200, depth_cm: 90, height_cm: 80, source_text: null }]
  });
  const items = [
    { id: "item-lamp", category: "lighting", role_label: "floor lamp", selection_reason: null, unit_price_aed: 300, sort_order: 1, spec_key: "4:floor_lamp", product: product("p-lamp", "lighting", "Arc Lamp") },
    { id: "item-sofa", category: "sofas", role_label: "anchor seating", selection_reason: null, unit_price_aed: 3000, sort_order: 2, spec_key: "0:sofa", product: product("p-sofa", "sofas", "Curved Sofa") }
  ];

  const calls: RecordedCall[] = [];
  const { client, storageCalls } = fakeSupabase(
    (call) => {
      calls.push(call);
      if (call.table === "room_assets" && call.filters.some(([column, value]) => column === "asset_type" && value === "room_photo")) {
        return { data: photos };
      }
      if (call.table === "room_assets") {
        return { data: null };
      }
      if (call.table === "concepts") {
        return {
          data: {
            id: "concept-1",
            title: "Quiet Lounge",
            description: "Calm and warm.",
            primary_image_asset: { storage_path: "u/room-1/concept-1.png", mime_type: "image/png" }
          }
        };
      }
      if (call.table === "room_design_specs") {
        return { data: specRow };
      }
      if (call.table === "shopping_list_items") {
        return { data: items };
      }
      if (call.table === "design_briefs") {
        return { data: { structured_json: { spatialIntent: { focalPoint: "tv_media_wall" } } } };
      }
      return { data: null };
    },
    (storageCall) =>
      storageCall.op === "download"
        ? { data: new Blob([Buffer.from(storageCall.path)]) }
        : { data: { signedUrl: `https://project.supabase.co/signed/${storageCall.path}` } }
  );

  const fetched: string[] = [];
  const loaded = await loadFinalRenderInputs({
    serviceSupabase: client,
    roomId: "room-1",
    roomType: "Living Room",
    conceptId: "concept-1",
    selectedShoppingItemIds: ["item-lamp", "item-sofa"],
    fetchImage: async (url) => {
      fetched.push(url);
      return { bytes: Buffer.from(url), mimeType: "image/jpeg" };
    }
  });

  // Every photograph, in created_at order, the first as the camera.
  const photoQuery = calls.find((call) => call.table === "room_assets" && call.filters.some(([column]) => column === "asset_type"));
  assert.ok(photoQuery, "photographs are read from room_assets");
  assert.deepEqual(photoQuery.order, [["created_at", { ascending: true }]]);
  assert.equal(photoQuery.limit, 3);
  assert.deepEqual(loaded.photos.map((photo) => photo.assetId), ["photo-1", "photo-2", "photo-3"]);
  assert.equal(loaded.photos[0].bytes.toString(), "u/room-1/p1.jpg");
  assert.ok(loaded.photos.every((photo) => photo.signedUrl?.startsWith("https://project.supabase.co/signed/")));
  assert.equal(storageCalls.filter((call) => call.op === "download" && call.bucket === "room-assets").length, 3);

  // The confirmed spec's preservation list and objects.
  assert.deepEqual(loaded.spec?.mustPreserve, ["the sliding doors to the garden", "the tray ceiling"]);
  assert.equal(loaded.spec?.objects.length, 2);
  const specQuery = calls.find((call) => call.table === "room_design_specs");
  assert.ok(specQuery?.filters.some(([column, value]) => column === "concept_id" && value === "concept-1"));

  // Products in render priority order: the sofa outranks the lamp whatever
  // the list's sort order said.
  assert.deepEqual(loaded.products.map((entry) => entry.itemId), ["item-sofa", "item-lamp"]);
  assert.equal(loaded.products[0].specKey, "0:sofa");
  assert.equal(loaded.products[0].dimensions, "W 200 cm x D 90 cm x H 80 cm");
  assert.deepEqual(fetched, ["https://cdn.example.com/p-sofa.jpg", "https://cdn.example.com/p-lamp.jpg"]);

  // The render input the hero call receives.
  const renderInput = loaded.renderInput({ imageDeadlineMs: 123_456 });
  assert.equal(renderInput.additionalRoomPhotos?.length, 2);
  assert.equal(renderInput.roomPhotoBytes.toString(), "u/room-1/p1.jpg");
  assert.deepEqual(renderInput.mustPreserve, ["the sliding doors to the garden", "the tray ceiling"]);
  assert.equal(renderInput.imageDeadlineMs, 123_456);
  assert.equal(renderInput.conceptImageBytes?.toString(), "u/room-1/concept-1.png");
  assert.equal(renderInput.products.length, 2);
  assert.equal(renderInput.products[0].name, "Curved Sofa");
  assert.equal(renderInput.spatialIntent?.focalPoint, "tv_media_wall");
  assert.equal(loaded.focalPoint, "tv_media_wall");

  // An extracted-but-unconfirmed spec is not a contract; a malformed row is
  // not a contract; and a room with one photograph has no additional photos.
  const { client: noSpecClient } = fakeSupabase(
    (call) => {
      if (call.table === "room_assets" && call.filters.some(([column, value]) => column === "asset_type" && value === "room_photo")) {
        return { data: [photos[0]] };
      }
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "Quiet Lounge", description: null, primary_image_asset: null } };
      }
      if (call.table === "room_design_specs") {
        return { data: { ...specRow, status: "extracted" } };
      }
      if (call.table === "shopping_list_items") {
        return { data: items };
      }
      return { data: null };
    },
    (storageCall) => (storageCall.op === "download" ? { data: new Blob([Buffer.from("x")]) } : { data: null })
  );
  const single = await loadFinalRenderInputs({
    serviceSupabase: noSpecClient,
    roomId: "room-1",
    roomType: "Living Room",
    conceptId: "concept-1",
    selectedShoppingItemIds: ["item-lamp", "item-sofa"],
    fetchImage: async () => null
  });
  assert.equal(single.spec, null, "only a confirmed spec is a contract");
  assert.equal(single.photos.length, 1);
  assert.equal(single.renderInput({}).additionalRoomPhotos?.length, 0);
  assert.equal(single.renderInput({}).mustPreserve, null);
  assert.equal(single.renderInput({}).conceptImageBytes, null);
  assert.equal(single.products[0].imageBytes, null, "a product without a fetchable image still renders by name");
  assert.equal(single.focalPoint, null, "no chosen focal point and no confirmed design: no assumption");

  // A brief that left the focal point unknown, on a living room whose
  // confirmed design carries a TV: the planner follows the layout rules' own
  // TV-wall assumption (four of the five harness rooms are this case).
  const { client: assumedClient } = fakeSupabase(
    (call) => {
      if (call.table === "room_assets" && call.filters.some(([column, value]) => column === "asset_type" && value === "room_photo")) {
        return { data: [photos[0]] };
      }
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "Quiet Lounge", description: null, primary_image_asset: null } };
      }
      if (call.table === "room_design_specs") {
        return { data: specRow };
      }
      if (call.table === "shopping_list_items") {
        return { data: items };
      }
      return { data: null };
    },
    (storageCall) => (storageCall.op === "download" ? { data: new Blob([Buffer.from("x")]) } : { data: null })
  );
  const assumed = await loadFinalRenderInputs({
    serviceSupabase: assumedClient,
    roomId: "room-1",
    roomType: "Living Room",
    conceptId: "concept-1",
    selectedShoppingItemIds: ["item-lamp", "item-sofa"],
    fetchImage: async () => null
  });
  assert.equal(assumed.spatialIntent.focalPoint, "unknown", "the brief itself is not rewritten");
  assert.equal(assumed.focalPoint, "tv_media_wall", "the design carries a TV, so the planner works from the TV wall");
}

// Review fix: a failed read is never "nothing on record". An errored spec or
// items read throws a plain error (retried by the queue), not the
// deterministic input error that fails the job at once.
async function reviewFixes() {
  const { FinalRenderInputError } = await import("./render-inputs");
  const erroring = (table: string) =>
    fakeSupabase(
      (call) => {
        if (call.table === table) {
          return { error: { message: `${table} read failed` } };
        }
        if (call.table === "room_assets") {
          return { data: [{ id: "photo-1", storage_path: "u/room-1/p1.jpg", mime_type: "image/jpeg", created_at: "2026-09-01T10:00:00Z" }] };
        }
        if (call.table === "concepts") {
          return { data: { id: "concept-1", title: "Quiet Lounge", description: null, primary_image_asset: null } };
        }
        if (call.table === "shopping_list_items") {
          return { data: [{ id: "item-sofa", category: "sofas", role_label: "sofa", selection_reason: null, unit_price_aed: 1, sort_order: 1, spec_key: "0:sofa", product: { id: "p", name: "Sofa", description: null, primary_image_url: null, retailer: { name: "R", status: "active" }, dimensions: [] } }] };
        }
        return { data: null };
      },
      (storageCall) => (storageCall.op === "download" ? { data: new Blob([Buffer.from("x")]) } : { data: null })
    ).client;
  for (const table of ["room_design_specs", "shopping_list_items", "design_briefs", "concepts"]) {
    await assert.rejects(
      loadFinalRenderInputs({ serviceSupabase: erroring(table), roomId: "room-1", roomType: "Living Room", conceptId: "concept-1", selectedShoppingItemIds: ["item-sofa"], fetchImage: async () => null }),
      (error: unknown) => error instanceof Error && !(error instanceof FinalRenderInputError) && /read failed/.test(error.message),
      `an errored ${table} read surfaces as a retryable error`
    );
  }
}

main()
  .then(reviewFixes)
  .then(() => {
    console.log("render-inputs tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
