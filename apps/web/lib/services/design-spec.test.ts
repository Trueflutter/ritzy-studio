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

  // --- A recent running extraction blocks a new paid call (in-flight guard)
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "Warm Gallery", status: "selected", primary_image_asset_id: "asset-1" } };
      }
      if (call.table === "room_design_specs") return { data: null };
      return { data: null };
    });
    let guardCall: RecordedCall | null = null;
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") {
        guardCall = call;
        return { data: { id: "job-running" } };
      }
      return { data: null };
    });
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT
    );
    assert.deepEqual(result, { status: "extraction_running" });
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op === "insert").length, 0);
    const filters = Object.fromEntries((guardCall as RecordedCall | null)?.filters ?? []);
    assert.equal(filters.room_id, "room-1", "the guard must scope to THIS room");
    assert.equal(filters.job_type, "spec_extraction");
    assert.equal(filters.status, "running");
    assert.equal((guardCall as RecordedCall | null)?.gte?.[0]?.[0], "created_at");
  }

  // --- A malformed CONFIRMED row (direct-write vandalism of one's own row)
  // never triggers paid re-extraction: honest failed state at zero spend
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "Warm Gallery", status: "selected", primary_image_asset_id: "asset-1" } };
      }
      if (call.table === "room_design_specs") {
        return { data: { id: "spec-1", room_id: "room-1", concept_id: "concept-1", objects: [{ bad: true }], must_preserve: [], status: "confirmed" } };
      }
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    let paidCall = false;
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT,
      {
        extract: async () => {
          paidCall = true;
          throw new Error("must not be reached");
        }
      }
    );
    assert.deepEqual(result, { status: "extraction_failed" });
    assert.equal(paidCall, false, "a malformed confirmed row must not incur provider spend");
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op === "insert").length, 0);
  }

  // --- A malformed stored row is re-extracted and REPLACED via upsert
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "Warm Gallery", status: "selected", primary_image_asset_id: "asset-1" } };
      }
      if (call.table === "room_design_specs" && call.op === "select") {
        return { data: { id: "spec-1", room_id: "room-1", concept_id: "concept-1", objects: [{ bad: true }], must_preserve: [], status: "extracted" } };
      }
      if (call.table === "room_design_specs" && call.op === "upsert") {
        // ignoreDuplicates: the existing (malformed) row wins the insert race
        return { data: null };
      }
      if (call.table === "room_design_specs" && call.op === "update") {
        return { data: { id: "spec-1", room_id: "room-1", concept_id: "concept-1", objects: OBJECTS, must_preserve: ["sliding doors"], status: "extracted" } };
      }
      if (call.table === "room_assets") {
        return { data: { storage_path: "u/room-1/concept-1.png", mime_type: "image/png" } };
      }
      return { data: null };
    }, (storageCall) => {
      if (storageCall.op === "download") return { data: new Blob([Buffer.from([1])]) };
      if (storageCall.op === "createSignedUrl") return { data: { signedUrl: "https://signed.example/r" } };
      return { data: null };
    });
    const serviceJobWrites: RecordedCall[] = [];
    const { client: service } = fakeSupabase((call) => {
      if (call.op !== "select") {
        serviceJobWrites.push(call);
      }
      if (call.table === "ai_jobs" && call.op === "insert") return { data: { id: "job-1" } };
      return { data: null };
    }, (storageCall) => {
      if (storageCall.op === "download") return { data: new Blob([Buffer.from([1])]) };
      if (storageCall.op === "createSignedUrl") return { data: { signedUrl: "https://signed.example/r" } };
      return { data: null };
    });
    let extracted = false;
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT,
      {
        extract: async () => {
          extracted = true;
          return {
            promptKey: "concept.spec_extraction",
            promptVersion: "test",
            model: "stub",
            textCostUsd: 0.001,
            objects: OBJECTS,
            mustPreserve: ["sliding doors"]
          };
        }
      }
    );
    assert.ok(extracted, "a malformed stored row must trigger re-extraction");
    assert.equal(result.status, "ready");
    assert.equal(result.status === "ready" && result.extractedNow, true);
    const upsert = calls.find((call: RecordedCall) => call.op === "upsert");
    assert.ok(upsert, "the write must go through the duplicate-safe upsert");
    assert.equal(upsert?.upsertOptions?.onConflict, "room_id,concept_id");
    assert.equal(upsert?.upsertOptions?.ignoreDuplicates, true, "a duplicate must never overwrite");
    // The malformed row is replaced only through the guarded repair transition,
    // which can never touch a confirmed row.
    const repair = calls.find((call: RecordedCall) => call.table === "room_design_specs" && call.op === "update");
    assert.ok(repair, "the malformed row must be repaired explicitly");
    assert.ok(
      repair?.filters.some(([column, value]) => column === "status" && value === "extracted"),
      "repair must be scoped to still-extracted rows"
    );
    // AC 4: every succeeded ai_jobs row carries its cost and model.
    const succeededUpdate = serviceJobWrites.find(
      (call) => call.table === "ai_jobs" && call.op === "update"
    );
    assert.equal(succeededUpdate?.payload?.status, "succeeded");
    assert.equal(succeededUpdate?.payload?.cost_estimate_usd, 0.001);
    assert.equal(succeededUpdate?.payload?.model, "stub");
  }

  // --- A lost insert race (another request stored first) recovers by reading
  // the winner's row back instead of wasting the paid call; the winner's row is
  // never overwritten (codex finding: first write wins).
  {
    let specSelects = 0;
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "Warm Gallery", status: "selected", primary_image_asset_id: "asset-1" } };
      }
      if (call.table === "room_design_specs" && call.op === "upsert") {
        // duplicate: the concurrent winner's row already holds the slot
        return { data: null };
      }
      if (call.table === "room_design_specs" && call.op === "select") {
        specSelects += 1;
        // First select is the existing-spec check (none stored); the SECOND is
        // the post-upsert-failure raced re-read, which finds a valid row.
        if (specSelects === 1) {
          return { data: null };
        }
        return {
          data: {
            id: "spec-1",
            room_id: "room-1",
            concept_id: "concept-1",
            objects: OBJECTS,
            must_preserve: [],
            status: "confirmed"
          }
        };
      }
      if (call.table === "room_assets") {
        return { data: { storage_path: "u/room-1/concept-1.png", mime_type: "image/png" } };
      }
      return { data: null };
    }, (storageCall) => {
      if (storageCall.op === "download") return { data: new Blob([Buffer.from([1])]) };
      if (storageCall.op === "createSignedUrl") return { data: { signedUrl: "https://s.example/r" } };
      return { data: null };
    });
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "insert") return { data: { id: "job-1" } };
      return { data: null };
    }, (storageCall) => {
      if (storageCall.op === "download") return { data: new Blob([Buffer.from([1])]) };
      if (storageCall.op === "createSignedUrl") return { data: { signedUrl: "https://s.example/r" } };
      return { data: null };
    });
    let recoveryExtracted = false;
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT,
      {
        extract: async () => {
          recoveryExtracted = true;
          return {
            promptKey: "concept.spec_extraction",
            promptVersion: "test",
            model: "stub",
            textCostUsd: 0.001,
            objects: OBJECTS,
            mustPreserve: []
          };
        }
      }
    );
    assert.ok(recoveryExtracted, "the paid call ran before the race was lost");
    assert.equal(specSelects >= 2, true, "the re-read must fire after the duplicate");
    assert.equal(result.status, "ready");
    assert.equal(result.status === "ready" && result.extractedNow, false, "recovery reads the winner's row back");
    assert.equal(
      result.status === "ready" && result.spec.status,
      "confirmed",
      "a CONFIRMED winner row must come back untouched"
    );
    assert.equal(
      calls.filter((call: RecordedCall) => call.table === "room_design_specs" && call.op === "update").length,
      0,
      "a valid winner row must never be overwritten"
    );
  }

  // --- A failing extraction marks the ai_job failed and resolves extraction_failed
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "Warm Gallery", status: "selected", primary_image_asset_id: "asset-1" } };
      }
      if (call.table === "room_design_specs") return { data: null };
      if (call.table === "room_assets") {
        return { data: { storage_path: "u/room-1/concept-1.png", mime_type: "image/png" } };
      }
      return { data: null };
    }, (storageCall) => {
      if (storageCall.op === "download") return { data: new Blob([Buffer.from([1])]) };
      if (storageCall.op === "createSignedUrl") return { data: { signedUrl: "https://s.example/r" } };
      return { data: null };
    });
    const serviceWrites: RecordedCall[] = [];
    const { client: service } = fakeSupabase((call) => {
      if (call.op !== "select") {
        serviceWrites.push(call);
        if (call.table === "ai_jobs" && call.op === "insert") return { data: { id: "job-1" } };
      }
      return { data: null };
    }, (storageCall) => {
      if (storageCall.op === "download") return { data: new Blob([Buffer.from([1])]) };
      if (storageCall.op === "createSignedUrl") return { data: { signedUrl: "https://s.example/r" } };
      return { data: null };
    });
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT,
      {
        extract: async () => {
          throw new Error("provider down");
        }
      }
    );
    assert.deepEqual(result, { status: "extraction_failed" });
    const failedUpdate = serviceWrites.find(
      (call) => call.table === "ai_jobs" && call.op === "update"
    );
    assert.equal(failedUpdate?.payload?.status, "failed");
    assert.equal(failedUpdate?.payload?.error_message, "provider down");
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
