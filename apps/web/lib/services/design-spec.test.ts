import assert from "node:assert/strict";

import { confirmRoomDesignSpec, ensureRoomDesignSpec } from "./design-spec";
import { fakeSupabase, type RecordedCall } from "./supabase-test-double";

// State-gate tests for the design-spec service. Extraction itself (the vision
// call) is covered by live acceptance runs; these pin the gates, the stored-spec
// fast path, and the confirm flow's validation and writes.

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example-project.supabase.co";

const INPUT = { userId: "user-1", roomId: "room-1" };

const OBJECTS = [
  {
    role: "sofa",
    label: "Three-seat sofa",
    quantity: 1,
    sizeDescriptor: "around 240 cm",
    capacity: "seats 3",
    paletteMaterials: ["ivory boucle"]
  }
];

async function main() {
  // --- No selected concept: no_selected_concept, and no extraction job is opened
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") return { data: null };
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT
    );
    assert.deepEqual(result, { status: "no_selected_concept" });
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op === "insert").length, 0);
  }

  // --- A stored, valid spec returns ready with no extraction
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "Warm Gallery", status: "selected", primary_image_asset_id: "asset-1" } };
      }
      if (call.table === "room_design_specs") {
        return {
          data: {
            id: "spec-1",
            room_id: "room-1",
            concept_id: "concept-1",
            objects: OBJECTS,
            must_preserve: ["sliding doors"],
            status: "confirmed"
          }
        };
      }
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT
    );
    assert.equal(result.status, "ready");
    assert.equal(result.status === "ready" && result.extractedNow, false);
    assert.equal(result.status === "ready" && result.spec.objects.length, 1);
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op === "insert").length, 0);
  }

  // --- Selected concept with no stored image cannot extract: concept_image_unprepared
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "Warm Gallery", status: "selected", primary_image_asset_id: null } };
      }
      if (call.table === "room_design_specs") return { data: null };
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: null }));
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT
    );
    assert.deepEqual(result, { status: "concept_image_unprepared" });
  }

  // --- Confirm: invalid objects are refused with no write
  {
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    const result = await confirmRoomDesignSpec(client, {
      roomId: "room-1",
      specId: "spec-1",
      objects: [{ role: "sofa", label: "Sofa", quantity: 0, sizeDescriptor: null, capacity: null, paletteMaterials: [] }],
      mustPreserve: []
    });
    assert.equal(result.status, "invalid");
    assert.equal(calls.filter((call: RecordedCall) => call.op === "update").length, 0);
  }

  // --- Confirm: a valid edit updates the row scoped to spec AND room, flips status
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "room_design_specs" && call.op === "select") {
        return { data: { id: "spec-1" } };
      }
      return { data: null };
    });
    const result = await confirmRoomDesignSpec(client, {
      roomId: "room-1",
      specId: "spec-1",
      objects: OBJECTS,
      mustPreserve: ["sliding doors to the terrace"]
    });
    assert.deepEqual(result, { status: "confirmed" });
    const update = calls.find((call: RecordedCall) => call.op === "update");
    assert.ok(update);
    assert.equal(update?.payload?.status, "confirmed");
    assert.deepEqual(update?.filters, [
      ["id", "spec-1"],
      ["room_id", "room-1"]
    ]);
  }

  // --- Confirm: unknown spec row resolves not_found without writing
  {
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    const result = await confirmRoomDesignSpec(client, {
      roomId: "room-1",
      specId: "missing",
      objects: OBJECTS,
      mustPreserve: []
    });
    assert.deepEqual(result, { status: "not_found" });
    assert.equal(calls.filter((call: RecordedCall) => call.op === "update").length, 0);
  }

  console.log("design-spec service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
