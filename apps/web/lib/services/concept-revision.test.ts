import assert from "node:assert/strict";

import { reviseConceptForRoom } from "./concept-revision";
import { fakeSupabase, type RecordedCall } from "./supabase-test-double";

// State-gate tests for the concept-revision service. The load-bearing contracts
// (S2): the anchor-block is GONE, so every concept can be revised; once past the
// brief gate the critique row is saved BEFORE any later failure, so a dead photo
// or missing previous render can never lose the user's critique.

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example-project.supabase.co";

const INPUT = {
  userId: "user-1",
  projectId: "proj-1",
  roomId: "room-1",
  conceptId: "concept-1",
  critique: "Swap the marble coffee table for warm walnut."
};

function noDefer() {
  throw new Error("defer must not run in gate tests");
}

async function main() {
  // --- Missing room or concept resolves not_found with zero writes
  {
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    const { client: service } = fakeSupabase(() => ({ data: null }));
    const result = await reviseConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer: noDefer }
    );
    assert.deepEqual(result, { status: "not_found" });
    assert.equal(calls.filter((call: RecordedCall) => call.op !== "select").length, 0);
  }

  // --- The anchor-block is removed (S2): a concept whose generation job carried
  // catalogue anchors proceeds like any other; the anchors are never even read.
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", generation_job_id: "job-9", design_brief_id: "brief-1", primary_image_asset_id: "asset-9" } };
      }
      if (call.table === "design_briefs") return { data: null };
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await reviseConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer: noDefer }
    );
    assert.deepEqual(result, { status: "missing_brief" });
    assert.equal(
      serviceCalls.filter((call: RecordedCall) => call.table === "ai_jobs" && call.op === "select").length,
      0,
      "the anchor read must be gone"
    );
  }

  // --- Missing brief resolves before the critique insert
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", generation_job_id: null, design_brief_id: "brief-1", primary_image_asset_id: "asset-9" } };
      }
      if (call.table === "design_briefs") return { data: null };
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: null }));
    const result = await reviseConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer: noDefer }
    );
    assert.deepEqual(result, { status: "missing_brief" });
    assert.equal(calls.filter((call: RecordedCall) => call.table === "concept_critiques").length, 0);
  }

  // --- Past the brief gate, the critique is saved even when the photo is missing
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", generation_job_id: null, design_brief_id: "brief-1", primary_image_asset_id: "asset-9" } };
      }
      if (call.table === "design_briefs") return { data: { id: "brief-1" } };
      if (call.table === "concept_critiques" && call.op === "insert") return { data: { id: "critique-1" } };
      if (call.table === "room_assets") return { data: null };
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: null }));
    const result = await reviseConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer: noDefer }
    );
    assert.deepEqual(result, { status: "missing_photo" });
    const critiqueInsert = calls.find(
      (call: RecordedCall) => call.table === "concept_critiques" && call.op === "insert"
    );
    assert.ok(critiqueInsert, "critique must be saved before the photo gate");
    assert.equal(critiqueInsert?.payload?.critique_text, INPUT.critique);
    assert.equal(critiqueInsert?.payload?.concept_id, "concept-1");
    assert.equal(critiqueInsert?.payload?.created_by_user_id, "user-1");
  }

  // --- A concept with no primary render resolves concept_image_unprepared,
  // with the critique already saved (revision freedom never loses the critique)
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", generation_job_id: null, design_brief_id: "brief-1", primary_image_asset_id: null } };
      }
      if (call.table === "design_briefs") return { data: { id: "brief-1" } };
      if (call.table === "concept_critiques" && call.op === "insert") return { data: { id: "critique-1" } };
      if (call.table === "room_assets") {
        return { data: [{ id: "photo-1", storage_path: "u/room-1/p1.jpg", mime_type: "image/jpeg" }] };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: null }));
    const result = await reviseConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer: noDefer }
    );
    assert.deepEqual(result, { status: "concept_image_unprepared" });
    assert.ok(
      calls.some((call: RecordedCall) => call.table === "concept_critiques" && call.op === "insert"),
      "critique must survive a missing previous render"
    );
  }

  // --- Success path (AC 5 unit half): the revised concept insert carries the
  // lineage and job id, the critique links to the produced version, the prior
  // selection clears, and the deferred QA task is registered but not run.
  {
    const writes: RecordedCall[] = [];
    const { client } = fakeSupabase((call) => {
      if (call.op !== "select") {
        writes.push(call);
        if (call.table === "concept_critiques" && call.op === "insert") return { data: { id: "critique-1" } };
        if (call.table === "concepts" && call.op === "insert") return { data: { id: "concept-2" } };
        if (call.table === "room_assets" && call.op === "insert") return { data: { id: "asset-2" } };
        return { data: null };
      }
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", generation_job_id: null, design_brief_id: "brief-1", primary_image_asset_id: "asset-1", title: "V1", description: "First direction" } };
      }
      if (call.table === "design_briefs") return { data: { id: "brief-1" } };
      if (call.table === "room_assets" && call.single) {
        return { data: { storage_path: "u/room-1/concept-1.png", mime_type: "image/png" } };
      }
      if (call.table === "room_assets") {
        return { data: [{ id: "photo-1", storage_path: "u/room-1/p1.jpg", mime_type: "image/jpeg" }] };
      }
      return { data: null };
    }, (storageCall) => {
      if (storageCall.op === "download") return { data: new Blob([Buffer.from([1, 2, 3])]) };
      if (storageCall.op === "createSignedUrl") return { data: { signedUrl: "https://signed.example/render" } };
      return { data: null };
    });
    const serviceWrites: RecordedCall[] = [];
    const { client: service } = fakeSupabase((call) => {
      if (call.op !== "select") {
        serviceWrites.push(call);
        if (call.table === "ai_jobs" && call.op === "insert") return { data: { id: "job-1" } };
        return { data: null };
      }
      return { data: null };
    }, (storageCall) => {
      if (storageCall.op === "download") return { data: new Blob([Buffer.from([9, 9])]) };
      if (storageCall.op === "createSignedUrl") return { data: { signedUrl: "https://signed.example/prev" } };
      if (storageCall.op === "upload") return { data: { path: "ok" } };
      return { data: null };
    });

    const deferred: Array<() => Promise<void>> = [];
    const stubResult = {
      promptKey: "concept.revision_from_critique",
      promptVersion: "test",
      textModel: "stub-model",
      textCostUsd: 0.001,
      imageProvider: "evolink" as const,
      imageModel: "stub-image",
      imageLatencySeconds: 1,
      imageFallbackUsed: false,
      imageFallbackError: null,
      imageCreditsUsed: 1,
      analysis: {
        detectedRoomType: "living room",
        fixedArchitecture: [],
        editableZones: [],
        fixedElementsToPreserve: [],
        lightingNotes: [],
        uncertaintyNotes: []
      },
      concept: {
        title: "V2",
        rationale: "Swapped the chair.",
        generationPrompt: "p".repeat(90),
        preserveList: [],
        allowedChangeList: [],
        uncertaintyNote: "Scale is directional."
      },
      imageBase64: Buffer.from([137, 80, 78, 71]).toString("base64"),
      revisedPrompt: null,
      changePlan: { mustChange: ["swap the chair"], mustPreserve: ["sofa"] }
    };

    const result = await reviseConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      {
        defer: (task) => deferred.push(task),
        generateRevision: async () => stubResult
      }
    );

    assert.equal(result.status, "revised");
    assert.equal(result.status === "revised" && result.conceptId, "concept-2");

    const conceptInsert = writes.find(
      (call) => call.table === "concepts" && call.op === "insert"
    );
    assert.ok(conceptInsert, "revised concept must be inserted");
    assert.equal(conceptInsert?.payload?.parent_concept_id, "concept-1", "lineage must be recorded");
    assert.equal(conceptInsert?.payload?.generation_job_id, "job-1");
    assert.equal(conceptInsert?.payload?.status, "generated");

    const linkUpdate = writes.find(
      (call) => call.table === "concept_critiques" && call.op === "update"
    );
    assert.ok(linkUpdate, "critique must link to the produced version");
    assert.equal(linkUpdate?.payload?.concept_version_link, "concept-2");
    assert.deepEqual(linkUpdate?.filters, [["id", "critique-1"]]);

    const clearSelection = writes.find(
      (call) =>
        call.table === "concepts" &&
        call.op === "update" &&
        (call.payload as { status?: string })?.status === "generated" &&
        call.filters.some(([column, value]) => column === "status" && value === "selected")
    );
    assert.ok(clearSelection, "the prior selection must be cleared");

    assert.equal(deferred.length, 1, "diff QA + views must be deferred, not run inline");
  }

  console.log("concept-revision service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
