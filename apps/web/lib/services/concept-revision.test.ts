import assert from "node:assert/strict";

import { reviseConceptForRoom } from "./concept-revision";
import { fakeSupabase, type RecordedCall } from "./supabase-test-double";

// State-gate tests for the concept-revision service. The load-bearing contracts:
// an anchored (sourcing-ready) concept refuses revision before anything is
// written, and once past the brief gate the critique row is saved BEFORE any
// later failure, so a dead photo can never lose the user's critique.

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

const ANCHOR = {
  productId: "00000000-0000-4000-8000-000000000001",
  category: "sofas",
  roleLabel: "sofa",
  priority: "required",
  selectionReason: "Anchors the palette."
};

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

  // --- An anchored concept refuses revision BEFORE the critique is saved
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", generation_job_id: "job-9", design_brief_id: "brief-1" } };
      }
      return { data: null };
    });
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "ai_jobs") {
        return { data: { output_summary: { catalogueGrounding: { selectedAnchors: [ANCHOR] } } } };
      }
      return { data: null };
    });
    const result = await reviseConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer: noDefer }
    );
    assert.deepEqual(result, { status: "anchored" });
    assert.equal(
      calls.filter((call: RecordedCall) => call.table === "concept_critiques").length,
      0,
      "anchored refusal must not save a critique"
    );
  }

  // --- Missing brief resolves before the critique insert
  {
    const { client, calls } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "concepts") {
        return { data: { id: "concept-1", generation_job_id: null, design_brief_id: "brief-1" } };
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
        return { data: { id: "concept-1", generation_job_id: null, design_brief_id: "brief-1" } };
      }
      if (call.table === "design_briefs") return { data: { id: "brief-1" } };
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

  console.log("concept-revision service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
