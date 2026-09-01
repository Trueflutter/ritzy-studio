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

  console.log("concept-revision service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
