import assert from "node:assert/strict";

import {
  confirmRoomDesignSpec,
  ensureRoomDesignSpec,
  readRoomDesignSpec,
  runRoomDesignSpecExtraction,
  startRoomDesignSpecExtraction
} from "./design-spec";
import type { ExtractRoomDesignSpecInput } from "@ritzy-studio/ai";

import { fakeSupabase, type RecordedCall, type Responder, type StorageResponder } from "./supabase-test-double";

// State-gate tests for the design-spec service (PR #332 review fix). The paid
// vision call is covered by live acceptance runs; these pin the lifecycle that
// keeps it honest: readers only read persisted state and reclaim expired
// leases, starters open at most one first-touch attempt per concept, and the
// detached runner always ends on a terminal write with its cost recorded.

process.env.NEXT_PUBLIC_SUPABASE_URL ??= "https://example-project.supabase.co";

const INPUT = { userId: "user-1", roomId: "room-1" };
const NOW = Date.parse("2026-09-02T10:00:00.000Z");
const LEASE_MS = 120_000;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();

const ROOM = { id: "room-1", room_type: "Living Room" };
const CONCEPT = { id: "concept-1", title: "Warm Gallery", status: "selected", primary_image_asset_id: "asset-1" };

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

const VALID_SPEC_ROW = {
  id: "spec-1",
  room_id: "room-1",
  concept_id: "concept-1",
  objects: OBJECTS,
  must_preserve: ["sliding doors"],
  status: "confirmed"
};

const EXTRACTION = {
  promptKey: "concept.spec_extraction",
  promptVersion: "test",
  model: "stub",
  textCostUsd: 0.001,
  objects: OBJECTS,
  mustPreserve: ["sliding doors"]
};

const RUNNING_JOB = { id: "job-running", status: "running", created_at: iso(10_000) };

// The user-scoped client: room + selected concept resolve by default; the spec
// row and everything else come from the override.
function userClient(respond: Responder = () => ({ data: null }), respondStorage?: StorageResponder) {
  return fakeSupabase((call) => {
    if (call.table === "rooms") return { data: ROOM };
    if (call.table === "concepts") return { data: CONCEPT };
    return respond(call);
  }, respondStorage);
}

const writes = (calls: RecordedCall[]) => calls.filter((call) => call.op !== "select");

const recorder = () => {
  const tasks: Array<() => Promise<void>> = [];
  return { tasks, defer: (task: () => Promise<void>) => tasks.push(task) };
};

async function main() {
  // ---------------------------------------------------------------- readers

  // --- No selected concept: no_selected_concept, nothing touched
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: ROOM };
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT);
    assert.deepEqual(result, { status: "no_selected_concept" });
    assert.equal(serviceCalls.length, 0);
  }

  // --- A stored, valid spec is ready with no job lookup at all
  {
    const { client } = userClient((call) => {
      if (call.table === "room_design_specs") return { data: VALID_SPEC_ROW };
      if (call.table === "room_assets") return { data: { storage_path: "u/r.png" } };
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(
      () => ({ data: null }),
      (storageCall) => (storageCall.op === "createSignedUrl" ? { data: { signedUrl: "https://s.example/r" } } : { data: null })
    );
    const result = await readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT);
    assert.equal(result.status, "ready");
    assert.equal(result.status === "ready" && result.spec.objects.length, 1);
    assert.equal(result.status === "ready" && result.renderSignedUrl, "https://s.example/r");
    assert.equal(serviceCalls.filter((call) => call.table === "ai_jobs").length, 0, "a stored spec needs no job read");
  }

  // --- Selected concept with no stored image cannot extract: concept_image_unprepared
  {
    const { client } = fakeSupabase((call) => {
      if (call.table === "rooms") return { data: ROOM };
      if (call.table === "concepts") return { data: { ...CONCEPT, primary_image_asset_id: null } };
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT);
    assert.deepEqual(result, { status: "concept_image_unprepared" });
    assert.equal(serviceCalls.length, 0);
  }

  // --- No attempt on record: extraction_needed, and the lookup is scoped to
  // THIS room and THIS concept (a failed job for an earlier version must not
  // block a re-approved revision)
  {
    const { client } = userClient();
    let jobQuery: RecordedCall | null = null;
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") {
        jobQuery = call;
      }
      return { data: null };
    });
    const result = await readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT, {
      now: NOW,
      leaseMs: LEASE_MS
    });
    assert.deepEqual(result, { status: "extraction_needed", conceptId: "concept-1" });
    const query = jobQuery as RecordedCall | null;
    const filters = Object.fromEntries(query?.filters ?? []);
    assert.equal(filters.room_id, "room-1");
    assert.equal(filters.job_type, "spec_extraction");
    assert.deepEqual(query?.contains, [["input_summary", { conceptId: "concept-1" }]]);
    assert.deepEqual(query?.order, [["created_at", { ascending: false }]]);
    assert.equal(query?.limit, 1);
    assert.equal(writes(serviceCalls).length, 0, "a reader never writes");
  }

  // --- A running job inside its lease reports running with the lease's expiry
  {
    const { client } = userClient();
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") return { data: RUNNING_JOB };
      return { data: null };
    });
    const result = await readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT, {
      now: NOW,
      leaseMs: LEASE_MS
    });
    assert.deepEqual(result, {
      status: "extraction_running",
      jobId: "job-running",
      startedAt: RUNNING_JOB.created_at,
      staleAt: new Date(Date.parse(RUNNING_JOB.created_at) + LEASE_MS).toISOString()
    });
    assert.equal(writes(serviceCalls).length, 0, "a live lease is never touched");
  }

  // --- A running job PAST its lease is reclaimed with a compare-and-swap and
  // reported failed (retryable): the user is never locked out behind a dead run
  {
    const { client } = userClient();
    let reclaim: RecordedCall | null = null;
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") {
        return { data: { ...RUNNING_JOB, created_at: iso(LEASE_MS + 1_000) } };
      }
      if (call.table === "ai_jobs" && call.op === "update") {
        reclaim = call;
        return { data: [{ id: "job-running" }] };
      }
      return { data: null };
    });
    const result = await readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT, {
      now: NOW,
      leaseMs: LEASE_MS
    });
    assert.deepEqual(result, { status: "extraction_failed", conceptId: "concept-1", retryable: true });
    const cas = reclaim as RecordedCall | null;
    assert.equal(cas?.payload?.status, "failed");
    assert.equal(typeof cas?.payload?.error_message, "string");
    assert.deepEqual(cas?.filters, [["id", "job-running"]]);
    assert.deepEqual(cas?.in, [["status", ["running", "queued"]]], "the reclaim must be a CAS on a still-live status");
  }

  // --- A CAS miss (the run reported in between the read and the reclaim) is
  // never read as a failure: the reader picks up the outcome the run left
  {
    let specReads = 0;
    const { client } = userClient((call) => {
      if (call.table === "room_design_specs") {
        specReads += 1;
        return { data: specReads === 1 ? null : VALID_SPEC_ROW };
      }
      if (call.table === "room_assets") return { data: { storage_path: "u/r.png" } };
      return { data: null };
    });
    const { client: service } = fakeSupabase(
      (call) => {
        if (call.table === "ai_jobs" && call.op === "select") {
          return { data: { ...RUNNING_JOB, created_at: iso(LEASE_MS + 1_000) } };
        }
        if (call.table === "ai_jobs" && call.op === "update") return { data: [] };
        return { data: null };
      },
      (storageCall) => (storageCall.op === "createSignedUrl" ? { data: { signedUrl: "https://s.example/r" } } : { data: null })
    );
    const result = await readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT, {
      now: NOW,
      leaseMs: LEASE_MS
    });
    assert.equal(result.status, "ready", "a lost reclaim race reads the winner's outcome back");
    assert.equal(specReads, 2);
  }

  // --- A reclaim that errors at the DB is surfaced, never mistaken for a lost race
  {
    const { client } = userClient();
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") {
        return { data: { ...RUNNING_JOB, created_at: iso(LEASE_MS + 1_000) } };
      }
      if (call.table === "ai_jobs" && call.op === "update") return { error: { message: "db down" } };
      return { data: null };
    });
    await assert.rejects(
      () => readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT, { now: NOW, leaseMs: LEASE_MS }),
      /db down/
    );
  }

  // --- A recorded failed attempt reports failed (retryable) and writes nothing
  {
    const { client } = userClient();
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") {
        return { data: { id: "job-failed", status: "failed", created_at: iso(60_000) } };
      }
      return { data: null };
    });
    const result = await readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT, {
      now: NOW,
      leaseMs: LEASE_MS
    });
    assert.deepEqual(result, { status: "extraction_failed", conceptId: "concept-1", retryable: true });
    assert.equal(writes(serviceCalls).length, 0);
  }

  // --- A malformed CONFIRMED row (direct-write vandalism of one's own row) is
  // an honest failed state at zero spend, with Retry withheld: no job lookup,
  // no writes
  {
    const { client } = userClient((call) => {
      if (call.table === "room_design_specs") {
        return { data: { ...VALID_SPEC_ROW, objects: [{ bad: true }] } };
      }
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const result = await readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT);
    assert.deepEqual(result, { status: "extraction_failed", conceptId: "concept-1", retryable: false });
    assert.equal(serviceCalls.length, 0);
  }

  // --- A malformed EXTRACTED row (never confirmed) falls through to the
  // attempt record: with a terminal job it is failed AND retryable, so the
  // runner's guarded repair stays reachable from the UI; nothing is written
  {
    const { client } = userClient((call) => {
      if (call.table === "room_design_specs") {
        return { data: { ...VALID_SPEC_ROW, status: "extracted", objects: [{ bad: true }] } };
      }
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") {
        return { data: { id: "job-done", status: "succeeded", created_at: iso(60_000) } };
      }
      return { data: null };
    });
    const result = await readRoomDesignSpec({ supabase: client, serviceSupabase: service }, INPUT, {
      now: NOW,
      leaseMs: LEASE_MS
    });
    assert.deepEqual(result, { status: "extraction_failed", conceptId: "concept-1", retryable: true });
    assert.equal(writes(serviceCalls).length, 0);
  }

  // --------------------------------------------------------------- starters

  // --- First touch (ensure): the lease row is opened, the runner is deferred
  // with ONLY the job id, and the page is told the lease's expiry
  {
    const { client } = userClient();
    let insert: RecordedCall | null = null;
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "insert") {
        insert = call;
        return { data: { id: "job-1" } };
      }
      return { data: null };
    });
    const { tasks, defer } = recorder();
    const ran: Array<{ jobId: string }> = [];
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer, run: async (input) => { ran.push(input); }, now: NOW, leaseMs: LEASE_MS }
    );
    assert.deepEqual(result, {
      status: "extraction_running",
      jobId: "job-1",
      startedAt: new Date(NOW).toISOString(),
      staleAt: new Date(NOW + LEASE_MS).toISOString()
    });
    const opened = insert as RecordedCall | null;
    assert.equal(opened?.payload?.job_type, "spec_extraction");
    assert.equal(opened?.payload?.status, "running");
    assert.equal(opened?.payload?.user_id, "user-1");
    assert.equal(opened?.payload?.room_id, "room-1");
    assert.deepEqual(opened?.payload?.input_summary, { roomId: "room-1", conceptId: "concept-1" });
    assert.equal(tasks.length, 1, "exactly one runner is scheduled");
    assert.equal(ran.length, 0, "the runner does not execute inside the request");
    await tasks[0]();
    assert.deepEqual(ran, [{ jobId: "job-1" }]);
  }

  // --- A page load after a recorded attempt NEVER spends again: the failed
  // state is reported, no lease is opened, nothing is scheduled
  {
    const { client } = userClient();
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") {
        return { data: { id: "job-failed", status: "failed", created_at: iso(60_000) } };
      }
      return { data: null };
    });
    const { tasks, defer } = recorder();
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer, run: async () => {}, now: NOW, leaseMs: LEASE_MS }
    );
    assert.deepEqual(result, { status: "extraction_failed", conceptId: "concept-1", retryable: true });
    assert.equal(serviceCalls.filter((call) => call.op === "insert").length, 0);
    assert.equal(tasks.length, 0);
  }

  // --- Spend never precedes its audit row: a failed lease insert schedules nothing
  {
    const { client } = userClient();
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "insert") return { error: { message: "insert refused" } };
      return { data: null };
    });
    const { tasks, defer } = recorder();
    const result = await ensureRoomDesignSpec(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer, run: async () => {}, now: NOW, leaseMs: LEASE_MS }
    );
    assert.deepEqual(result, { status: "extraction_failed", conceptId: "concept-1", retryable: true });
    assert.equal(tasks.length, 0);
  }

  // --- The explicit starter (approval, Retry) opens a fresh attempt after a
  // recorded failure ...
  {
    const { client } = userClient();
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") {
        return { data: { id: "job-failed", status: "failed", created_at: iso(60_000) } };
      }
      if (call.table === "ai_jobs" && call.op === "insert") return { data: { id: "job-2" } };
      return { data: null };
    });
    const { tasks, defer } = recorder();
    const result = await startRoomDesignSpecExtraction(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer, run: async () => {}, now: NOW, leaseMs: LEASE_MS }
    );
    assert.deepEqual(result, { status: "started", jobId: "job-2" });
    assert.equal(serviceCalls.filter((call) => call.op === "insert").length, 1);
    assert.equal(tasks.length, 1);
  }

  // ... and on a room with no attempt yet (approval of a fresh concept)
  {
    const { client } = userClient();
    const { client: service } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "insert") return { data: { id: "job-3" } };
      return { data: null };
    });
    const { tasks, defer } = recorder();
    const result = await startRoomDesignSpecExtraction(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer, run: async () => {}, now: NOW, leaseMs: LEASE_MS }
    );
    assert.deepEqual(result, { status: "started", jobId: "job-3" });
    assert.equal(tasks.length, 1);
  }

  // --- Retry on a malformed EXTRACTED row opens a fresh lease and schedules
  // exactly one runner (the path that reaches the guarded repair)
  {
    const { client } = userClient((call) => {
      if (call.table === "room_design_specs") {
        return { data: { ...VALID_SPEC_ROW, status: "extracted", objects: [{ bad: true }] } };
      }
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") {
        return { data: { id: "job-done", status: "succeeded", created_at: iso(60_000) } };
      }
      if (call.table === "ai_jobs" && call.op === "insert") return { data: { id: "job-4" } };
      return { data: null };
    });
    const { tasks, defer } = recorder();
    const result = await startRoomDesignSpecExtraction(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer, run: async () => {}, now: NOW, leaseMs: LEASE_MS }
    );
    assert.deepEqual(result, { status: "started", jobId: "job-4" });
    assert.equal(serviceCalls.filter((call) => call.op === "insert").length, 1);
    assert.equal(tasks.length, 1);
  }

  // --- ... but never doubles a live lease, re-extracts a stored spec, or
  // spends on a confirmed row that can never be repaired
  {
    const { client } = userClient();
    const { client: service, calls: serviceCalls } = fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") return { data: RUNNING_JOB };
      return { data: null };
    });
    const { tasks, defer } = recorder();
    const result = await startRoomDesignSpecExtraction(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer, run: async () => {}, now: NOW, leaseMs: LEASE_MS }
    );
    assert.deepEqual(result, { status: "already_running", jobId: "job-running" });
    assert.equal(serviceCalls.filter((call) => call.op === "insert").length, 0);
    assert.equal(tasks.length, 0);
  }
  {
    const { client } = userClient((call) => {
      if (call.table === "room_design_specs") return { data: VALID_SPEC_ROW };
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const { tasks, defer } = recorder();
    const result = await startRoomDesignSpecExtraction(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer, run: async () => {}, now: NOW, leaseMs: LEASE_MS }
    );
    assert.deepEqual(result, { status: "already_ready" });
    assert.equal(serviceCalls.filter((call) => call.op === "insert").length, 0);
    assert.equal(tasks.length, 0);
  }
  {
    const { client } = userClient((call) => {
      if (call.table === "room_design_specs") return { data: { ...VALID_SPEC_ROW, objects: [{ bad: true }] } };
      return { data: null };
    });
    const { client: service, calls: serviceCalls } = fakeSupabase(() => ({ data: null }));
    const { tasks, defer } = recorder();
    const result = await startRoomDesignSpecExtraction(
      { supabase: client, serviceSupabase: service },
      INPUT,
      { defer, run: async () => {}, now: NOW, leaseMs: LEASE_MS }
    );
    assert.deepEqual(result, { status: "cannot_start", reason: "not_retryable" });
    assert.equal(serviceCalls.length, 0);
    assert.equal(tasks.length, 0);
  }

  // ----------------------------------------------------------------- runner

  const JOB_ROW = { id: "job-1", status: "running", room_id: "room-1", input_summary: { roomId: "room-1", conceptId: "concept-1" } };
  const RUNNER_STORAGE: StorageResponder = (storageCall) => {
    if (storageCall.op === "download") return { data: new Blob([Buffer.from([1])]) };
    if (storageCall.op === "createSignedUrl") return { data: { signedUrl: "https://s.example/r" } };
    return { data: null };
  };
  // Everything the runner reads comes through the service client, re-derived
  // from the job row; `respond` overrides the spec-table behaviour per case.
  function runnerService(respond: Responder, job: Record<string, unknown> = JOB_ROW) {
    return fakeSupabase((call) => {
      if (call.table === "ai_jobs" && call.op === "select") return { data: job };
      if (call.table === "rooms") return { data: ROOM };
      if (call.table === "concepts") return { data: { id: "concept-1", primary_image_asset_id: "asset-1" } };
      if (call.table === "room_assets") return { data: { storage_path: "u/room-1/concept-1.png", mime_type: "image/png" } };
      return respond(call);
    }, RUNNER_STORAGE);
  }
  const jobUpdate = (calls: RecordedCall[]) => calls.find((call) => call.table === "ai_jobs" && call.op === "update");

  // --- A job that is no longer a live lease (reclaimed, or already reported)
  // never spends again: at-least-once safety
  {
    const { client: service, calls } = runnerService(() => ({ data: null }), { ...JOB_ROW, status: "failed" });
    let paidCall = false;
    await runRoomDesignSpecExtraction(service, { jobId: "job-1" }, {
      extract: async () => {
        paidCall = true;
        return EXTRACTION;
      }
    });
    assert.equal(paidCall, false);
    assert.equal(writes(calls).length, 0);
  }

  // --- Success: the paid call runs once with inputs re-derived from the job
  // row (room type, render bytes, brief, measurements), the spec is stored
  // first-write-wins, and the job row closes succeeded with its cost and model
  // (AC 4)
  {
    const { client: service, calls } = runnerService((call) => {
      if (call.table === "room_design_specs" && call.op === "upsert") {
        return { data: { ...VALID_SPEC_ROW, status: "extracted", extraction_job_id: "job-1" } };
      }
      if (call.table === "design_briefs") {
        return { data: { style_notes: "warm", color_notes: "ivory", functional_requirements: "tv wall", avoid_notes: "no red" } };
      }
      if (call.table === "room_measurements") {
        return { data: { wall_length_cm: 520, room_depth_cm: 410, ceiling_height_cm: 300 } };
      }
      return { data: null };
    });
    let paidCalls = 0;
    let extractInput: ExtractRoomDesignSpecInput | null = null;
    await runRoomDesignSpecExtraction(service, { jobId: "job-1" }, {
      extract: async (input) => {
        paidCalls += 1;
        extractInput = input;
        return EXTRACTION;
      }
    });
    assert.equal(paidCalls, 1);
    const seen = extractInput as ExtractRoomDesignSpecInput | null;
    assert.equal(seen?.roomType, "Living Room");
    assert.equal(seen?.conceptImage.mimeType, "image/png");
    assert.ok((seen?.conceptImage.bytes.length ?? 0) > 0, "the render bytes must reach the provider");
    assert.deepEqual(seen?.brief, {
      styleNotes: "warm",
      colorNotes: "ivory",
      functionalRequirements: "tv wall",
      avoidNotes: "no red"
    });
    assert.deepEqual(seen?.measurements, { wallLengthCm: 520, roomDepthCm: 410, ceilingHeightCm: 300 });
    const upsert = calls.find((call) => call.op === "upsert");
    assert.equal(upsert?.table, "room_design_specs");
    assert.equal(upsert?.upsertOptions?.onConflict, "room_id,concept_id");
    assert.equal(upsert?.upsertOptions?.ignoreDuplicates, true, "a duplicate must never overwrite");
    assert.equal(upsert?.payload?.extraction_job_id, "job-1");
    const closed = jobUpdate(calls);
    assert.equal(closed?.payload?.status, "succeeded");
    assert.equal(closed?.payload?.cost_estimate_usd, 0.001);
    assert.equal(closed?.payload?.model, "stub");
    assert.equal(closed?.payload?.prompt_version, "test");
    assert.deepEqual(closed?.filters, [["id", "job-1"]]);
    assert.equal((closed?.payload?.output_summary as { objectCount?: number })?.objectCount, 1);
    assert.equal(calls.filter((call) => call.table === "room_design_specs" && call.op === "update").length, 0);
  }

  // --- A failing provider closes the job failed with the message; nothing is stored
  {
    const { client: service, calls } = runnerService(() => ({ data: null }));
    await runRoomDesignSpecExtraction(service, { jobId: "job-1" }, {
      extract: async () => {
        throw new Error("provider down");
      }
    });
    const closed = jobUpdate(calls);
    assert.equal(closed?.payload?.status, "failed");
    assert.equal(closed?.payload?.error_message, "provider down");
    assert.equal(calls.filter((call) => call.table === "room_design_specs" && call.op !== "select").length, 0);
  }

  // --- A lost insert race (another run stored first) keeps the winner's row
  // untouched and still closes the job honestly
  {
    const { client: service, calls } = runnerService((call) => {
      if (call.table === "room_design_specs" && call.op === "upsert") return { data: null };
      if (call.table === "room_design_specs" && call.op === "select") return { data: VALID_SPEC_ROW };
      return { data: null };
    });
    await runRoomDesignSpecExtraction(service, { jobId: "job-1" }, { extract: async () => EXTRACTION });
    assert.equal(
      calls.filter((call) => call.table === "room_design_specs" && call.op === "update").length,
      0,
      "a valid winner row (here CONFIRMED) must never be overwritten"
    );
    const closed = jobUpdate(calls);
    assert.equal(closed?.payload?.status, "succeeded");
    assert.equal((closed?.payload?.output_summary as { storedByAnotherRun?: boolean })?.storedByAnotherRun, true);
  }

  // --- A malformed stored EXTRACTED row is repaired only through the guarded
  // transition scoped to still-extracted rows
  {
    const { client: service, calls } = runnerService((call) => {
      if (call.table === "room_design_specs" && call.op === "upsert") return { data: null };
      if (call.table === "room_design_specs" && call.op === "select") {
        return { data: { ...VALID_SPEC_ROW, status: "extracted", objects: [{ bad: true }] } };
      }
      if (call.table === "room_design_specs" && call.op === "update") {
        return { data: { ...VALID_SPEC_ROW, status: "extracted" } };
      }
      return { data: null };
    });
    await runRoomDesignSpecExtraction(service, { jobId: "job-1" }, { extract: async () => EXTRACTION });
    const repair = calls.find((call) => call.table === "room_design_specs" && call.op === "update");
    assert.ok(repair, "the malformed row must be repaired explicitly");
    assert.ok(
      repair?.filters.some(([column, value]) => column === "status" && value === "extracted"),
      "repair must be scoped to still-extracted rows"
    );
    const closed = jobUpdate(calls);
    assert.equal(closed?.payload?.status, "succeeded");
    assert.equal((closed?.payload?.output_summary as { repairedStoredRow?: boolean })?.repairedStoredRow, true);
  }

  // --- Honest cost: a spec write that fails AFTER the paid call still records
  // the spend on the failed job row
  {
    const { client: service, calls } = runnerService((call) => {
      if (call.table === "room_design_specs" && call.op === "upsert") return { error: { message: "write refused" } };
      return { data: null };
    });
    await runRoomDesignSpecExtraction(service, { jobId: "job-1" }, { extract: async () => EXTRACTION });
    const closed = jobUpdate(calls);
    assert.equal(closed?.payload?.status, "failed");
    assert.equal(closed?.payload?.error_message, "write refused");
    assert.equal(closed?.payload?.cost_estimate_usd, 0.001, "spend that happened is recorded even on failure");
    assert.equal(closed?.payload?.model, "stub");
  }

  // ---------------------------------------------------------------- confirm

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
