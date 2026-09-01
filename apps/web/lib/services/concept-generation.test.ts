import assert from "node:assert/strict";

import { generateInitialConceptForRoom, hasRequiredRoomSize, selectConcept } from "./concept-generation";
import { fakeSupabase, type RecordedCall, type Responder } from "./supabase-test-double";

// State-gate tests for the concept-generation service: the read/gate sequence and
// its terminal results are the service's contract. Generation itself (the AI call
// onward) is covered by the provider-hardening suite and live acceptance runs.

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example-project.supabase.co";

const INPUT = { userId: "user-1", projectId: "proj-1", roomId: "room-1" };

function noDefer() {
  throw new Error("defer must not run in gate tests");
}

function entitlementProbe() {
  const events: string[] = [];
  return {
    events,
    ensureEntitled: async () => {
      events.push("ensureEntitled");
    },
    track: (respond: Responder): Responder => {
      return (call) => {
        events.push(`${call.op}:${call.table}`);
        return respond(call);
      };
    }
  };
}

async function main() {
  // --- Missing room resolves room_not_found; the entitlement gate never runs
  {
    const probe = entitlementProbe();
    const { client, calls } = fakeSupabase(probe.track(() => ({ data: null })));
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await generateInitialConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { ensureEntitled: probe.ensureEntitled, defer: noDefer }
    );
    assert.deepEqual(result, { status: "room_not_found" });
    assert.ok(!probe.events.includes("ensureEntitled"));
    assert.equal(calls.filter((call: RecordedCall) => call.op !== "select").length, 0);
    assert.equal(serviceCalls.length, 0);
  }

  // --- Missing brief resolves missing_brief, and the entitlement gate runs at its
  // pre-extraction position: after the project read, before the brief read.
  {
    const probe = entitlementProbe();
    const { client } = fakeSupabase(
      probe.track((call) => {
        if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
        if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
        return { data: null };
      })
    );
    const { client: service } = fakeSupabase(() => ({ data: null }));
    const result = await generateInitialConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { ensureEntitled: probe.ensureEntitled, defer: noDefer }
    );
    assert.deepEqual(result, { status: "missing_brief" });
    const order = probe.events;
    assert.ok(
      order.indexOf("select:projects") < order.indexOf("ensureEntitled"),
      `entitlement must follow the project read; saw ${order.join(", ")}`
    );
    assert.ok(
      order.indexOf("ensureEntitled") < order.indexOf("select:design_briefs"),
      `entitlement must precede the brief read; saw ${order.join(", ")}`
    );
  }

  // --- An existing generated concept short-circuits before any job insert
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "design_briefs") return { data: { id: "brief-1" } };
      if (call.table === "concepts") return { data: { id: "concept-1" } };
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await generateInitialConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { ensureEntitled: async () => {}, defer: noDefer }
    );
    assert.deepEqual(result, { status: "already_generated" });
    assert.equal(serviceCalls.filter((call: RecordedCall) => call.op === "insert").length, 0);
  }

  // --- No room photo resolves missing_photo
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "design_briefs") return { data: { id: "brief-1" } };
      if (call.table === "concepts") return { data: null };
      if (call.table === "room_assets") return { data: [] };
      return { data: null };
    });
    const { client: service } = fakeSupabase(() => ({ data: null }));
    const result = await generateInitialConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { ensureEntitled: async () => {}, defer: noDefer }
    );
    assert.deepEqual(result, { status: "missing_photo" });
  }

  // --- A recent running job for the same brief resolves already_running
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: { id: "room-1", room_type: "Living Room" } };
      if (call.table === "projects") return { data: { id: "proj-1", budget_max_aed: null } };
      if (call.table === "design_briefs") return { data: { id: "brief-1" } };
      if (call.table === "concepts") return { data: null };
      if (call.table === "room_assets") {
        return { data: [{ id: "photo-1", storage_path: "u/room-1/p1.jpg", mime_type: "image/jpeg" }] };
      }
      return { data: null };
    });
    let runningJobCall: RecordedCall | null = null;
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") {
        runningJobCall = call;
        return { data: { id: "job-1" } };
      }
      return { data: null };
    });
    const result = await generateInitialConceptForRoom(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { ensureEntitled: async () => {}, defer: noDefer }
    );
    assert.deepEqual(result, { status: "already_running" });
    const filters = Object.fromEntries((runningJobCall as RecordedCall | null)?.filters ?? []);
    assert.equal(filters.job_type, "initial_concept_generation");
    assert.equal(filters.status, "running");
    assert.deepEqual((runningJobCall as RecordedCall | null)?.contains?.[0], [
      "input_summary",
      { designBriefId: "brief-1" }
    ]);
    // The dedupe window is time-bounded on created_at; without it any historical
    // running row would block generation forever.
    assert.equal((runningJobCall as RecordedCall | null)?.gte?.[0]?.[0], "created_at");
  }

  // --- selectConcept: rejects the room's concepts, then selects the target
  {
    const { client, calls } = fakeSupabase(() => ({ data: null }));
    await selectConcept(client, { roomId: "room-1", conceptId: "concept-2" });
    const updates = calls.filter((call: RecordedCall) => call.op === "update");
    assert.equal(updates.length, 2);
    assert.deepEqual(updates[0].payload, { status: "rejected" });
    assert.deepEqual(updates[0].filters, [["room_id", "room-1"]]);
    assert.deepEqual(updates[1].payload, { status: "selected" });
    assert.deepEqual(updates[1].filters, [["id", "concept-2"]]);
  }

  // --- hasRequiredRoomSize needs all three dimensions
  assert.equal(hasRequiredRoomSize({ wall_length_cm: 500, room_depth_cm: 400, ceiling_height_cm: 280 }), true);
  assert.equal(hasRequiredRoomSize({ wall_length_cm: 500, room_depth_cm: 400, ceiling_height_cm: null }), false);
  assert.equal(hasRequiredRoomSize({}), false);

  console.log("concept-generation service tests passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
