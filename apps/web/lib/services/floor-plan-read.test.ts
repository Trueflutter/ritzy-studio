import assert from "node:assert/strict";

import { fakeSupabase, type RecordedCall } from "./supabase-test-double";
import { confirmDetectedRoom, readFloorPlanForRoom, revertToWholePlan } from "./floor-plan-read";

// S5b: reading a floor plan costs money and, if it goes wrong quietly, costs
// a shopper a wrong measurement written as verified. So the two things pinned
// here are: nothing is spent unless the decision says spend, and no path
// leaves an `ai_jobs` row `running`.

const ROOM = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";
const ASSET = "33333333-3333-4333-8333-333333333333";

type Asset = {
  id: string;
  storage_path: string;
  mime_type: string | null;
  width_px: number | null;
  height_px: number | null;
} | null;

type Job = { status: string; input_summary: Record<string, unknown> } | null;

function harness({ asset, job }: { asset?: Asset; job?: Job } = {}) {
  const calls: RecordedCall[] = [];
  const plan: Asset =
    asset === undefined
      ? { id: ASSET, storage_path: `${USER}/${ROOM}/floor-plan/plan.png`, mime_type: "image/png", width_px: 2400, height_px: 1700 }
      : asset;

  const respond = (call: RecordedCall) => {
    calls.push(call);
    if (call.table === "room_assets" && call.op === "select") {
      return { data: plan };
    }
    if (call.table === "ai_jobs" && call.op === "select") {
      return { data: job ?? null };
    }
    if (call.table === "ai_jobs" && call.op === "insert") {
      return { data: { id: "job-1" } };
    }
    return { data: null };
  };

  const { client } = fakeSupabase(respond);
  return {
    calls,
    supabase: client as never,
    serviceSupabase: client as never,
    inserted: () => calls.filter((call) => call.table === "ai_jobs" && call.op === "insert"),
    closed: () => calls.filter((call) => call.table === "ai_jobs" && call.op === "update")
  };
}

const rooms = [
  {
    label: "Living Room",
    level: "Main",
    wallLengthCm: 520,
    roomDepthCm: 410,
    ceilingHeightCm: null,
    box: { x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.5 }
  }
];

async function main() {
  // ------------------------------------------------------------- the read
  {
    const h = harness();
    const outcome = await readFloorPlanForRoom(
      { roomId: ROOM, userId: USER, supabase: h.supabase, serviceSupabase: h.serviceSupabase },
      {
        planDataUrl: async () => "data:image/jpeg;base64,PLAN",
        readPlan: async () => ({
          read: { unitRead: "metres" as const, rooms, roomsFound: rooms.length },
          promptKey: "brief.floor_plan_read",
          promptVersion: "2026-09-10.1",
          model: "gpt-5-mini",
          textCostUsd: 0.004
        })
      }
    );

    assert.equal(outcome.status, "read");
    assert.deepEqual(outcome.status === "read" ? outcome.rooms : null, rooms);

    const opened = h.inserted();
    assert.equal(opened.length, 1, "one call, one row");
    assert.equal(opened[0].payload?.job_type, "floor_plan_read");
    assert.equal(opened[0].payload?.status, "running");
    assert.equal(opened[0].payload?.room_id, ROOM);
    assert.equal(opened[0].payload?.user_id, USER);
    assert.deepEqual(
      (opened[0].payload?.input_summary as Record<string, unknown>).assetId,
      ASSET,
      "the row names the plan it read, which is what the screen compares against the attached one"
    );

    const closed = h.closed();
    assert.equal(closed.length, 1);
    assert.equal(closed[0].payload?.status, "succeeded");
    assert.equal(closed[0].payload?.cost_estimate_usd, 0.004);
    assert.equal(closed[0].payload?.prompt_version, "2026-09-10.1");
    const output = closed[0].payload?.output_summary as { rooms: unknown[]; unitRead: string; roomsFound: number };
    assert.equal(output.unitRead, "metres");
    assert.equal(output.roomsFound, 1, "so a shortened list can say it was shortened");
    assert.deepEqual(output.rooms, rooms, "the answer is on the row, so the screen never re-reads a plan to render it");
  }

  // ------------------------------------------------------ the model throws
  {
    const h = harness();
    const outcome = await readFloorPlanForRoom(
      { roomId: ROOM, userId: USER, supabase: h.supabase, serviceSupabase: h.serviceSupabase },
      {
        planDataUrl: async () => "data:image/jpeg;base64,PLAN",
        readPlan: async () => {
          throw new Error("provider down");
        }
      }
    );

    assert.equal(outcome.status, "failed");
    const closed = h.closed();
    assert.equal(closed.length, 1, "a throw still closes the row it opened");
    assert.equal(closed[0].payload?.status, "failed");
    assert.match(String(closed[0].payload?.error_message), /provider down/);
  }

  // --------------------------------------------- a read that finds nothing
  {
    const h = harness();
    const outcome = await readFloorPlanForRoom(
      { roomId: ROOM, userId: USER, supabase: h.supabase, serviceSupabase: h.serviceSupabase },
      {
        planDataUrl: async () => "data:image/jpeg;base64,PLAN",
        readPlan: async () => ({
          read: { unitRead: "unknown" as const, rooms: [], roomsFound: 0 },
          promptKey: "brief.floor_plan_read",
          promptVersion: "2026-09-10.1",
          model: "gpt-5-mini",
          textCostUsd: 0.002
        })
      }
    );

    // A call that answered "no rooms" succeeded. Recording it as failed would
    // offer a retry that buys the same answer again.
    assert.equal(outcome.status, "read");
    assert.deepEqual(outcome.status === "read" ? outcome.rooms : null, []);
    assert.equal(h.closed()[0].payload?.status, "succeeded");
  }

  // ----------------------------------- the plan that cannot be prepared
  {
    const h = harness();
    const outcome = await readFloorPlanForRoom(
      { roomId: ROOM, userId: USER, supabase: h.supabase, serviceSupabase: h.serviceSupabase },
      {
        planDataUrl: async () => null,
        readPlan: async () => {
          throw new Error("must not be called");
        }
      }
    );

    assert.equal(outcome.status, "failed");
    assert.equal(h.inserted().length, 0, "nothing is opened before the bytes are in hand");
  }

  // -------------------------------------------- every refusal costs nothing
  const refusals: Array<{ name: string; asset?: Asset; job?: Job; reason: string }> = [
    { name: "no plan attached", asset: null, reason: "no_plan" },
    {
      name: "a PDF, which no reader in this app can open",
      asset: {
        id: ASSET,
        storage_path: "p.pdf",
        mime_type: "application/pdf",
        width_px: null,
        height_px: null
      },
      reason: "unreadable_format"
    },
    {
      name: "a listing thumbnail, whose dimension strings are four pixels tall",
      asset: { id: ASSET, storage_path: "p.jpeg", mime_type: "image/jpeg", width_px: 390, height_px: 578 },
      reason: "too_small"
    },
    {
      name: "a plan already read",
      job: { status: "succeeded", input_summary: { assetId: ASSET } },
      reason: "already_read"
    },
    {
      name: "a read already in flight",
      job: { status: "running", input_summary: { assetId: ASSET } },
      reason: "in_flight"
    }
  ];

  for (const refusal of refusals) {
    const h = harness({ asset: refusal.asset, job: refusal.job });
    const outcome = await readFloorPlanForRoom(
      { roomId: ROOM, userId: USER, supabase: h.supabase, serviceSupabase: h.serviceSupabase },
      {
        planDataUrl: async () => {
          throw new Error("must not be called");
        },
        readPlan: async () => {
          throw new Error("must not be called");
        }
      }
    );

    assert.equal(outcome.status, "skipped", refusal.name);
    assert.equal(outcome.status === "skipped" ? outcome.reason : null, refusal.reason, refusal.name);
    assert.equal(h.inserted().length, 0, `${refusal.name}: no row, so no cost and no state to clean up`);
  }

  // A failed read is not a refusal: the retry the screen offers is this call.
  {
    const h = harness({ job: { status: "failed", input_summary: { assetId: ASSET } } });
    const outcome = await readFloorPlanForRoom(
      { roomId: ROOM, userId: USER, supabase: h.supabase, serviceSupabase: h.serviceSupabase },
      {
        planDataUrl: async () => "data:image/jpeg;base64,PLAN",
        readPlan: async () => ({
          read: { unitRead: "metres" as const, rooms, roomsFound: rooms.length },
          promptKey: "brief.floor_plan_read",
          promptVersion: "2026-09-10.1",
          model: "gpt-5-mini",
          textCostUsd: 0.004
        })
      }
    );
    assert.equal(outcome.status, "read");
    assert.equal(h.inserted().length, 1);
  }

  // ------------------------------------------------------- confirming a room
  const detected = [
    { label: "Living Room", level: null, wallLengthCm: 470, roomDepthCm: 320, ceilingHeightCm: null, box: { x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.5 } },
    // The villa brochure case: named and located, no size printed legibly.
    { label: "Family Room", level: "Upper", wallLengthCm: null, roomDepthCm: null, ceilingHeightCm: null, box: { x0: 0.5, y0: 0.1, x1: 0.9, y1: 0.5 } },
    { label: "Store", level: null, wallLengthCm: null, roomDepthCm: null, ceilingHeightCm: null, box: null }
  ];

  function confirmHarness({ assetId = ASSET, brief = null }: { assetId?: string; brief?: Record<string, unknown> | null } = {}) {
    const calls: RecordedCall[] = [];
    const respond = (call: RecordedCall) => {
      calls.push(call);
      if (call.table === "room_assets") {
        return { data: { id: ASSET, storage_path: "p.png", mime_type: "image/png", width_px: 2400, height_px: 1700 } };
      }
      if (call.table === "ai_jobs" && call.op === "select") {
        return { data: { status: "succeeded", input_summary: { assetId }, output_summary: { rooms: detected } } };
      }
      if (call.table === "design_briefs" && call.op === "select") {
        return { data: brief ? { id: "brief-1", structured_json: brief } : null };
      }
      return { data: null };
    };
    const { client } = fakeSupabase(respond);
    return {
      calls,
      supabase: client as never,
      measurements: () => calls.filter((call) => call.table === "room_measurements" && call.op === "insert"),
      briefWrites: () => calls.filter((call) => call.table === "design_briefs" && (call.op === "update" || call.op === "insert"))
    };
  }

  // A room the plan sizes AND locates: both halves land.
  {
    const h = confirmHarness({ brief: { visualPreferences: { likedStyleSlugs: ["quiet-luxury"] } } });
    const outcome = await confirmDetectedRoom({ roomId: ROOM, roomIndex: 0, supabase: h.supabase });

    assert.deepEqual(outcome, { status: "confirmed", wroteMeasurements: true, recordedBox: true, label: "Living Room" });

    const written = h.measurements();
    assert.equal(written.length, 1);
    assert.equal(written[0].payload?.source, "floor_plan", "the provenance the criterion asks for");
    assert.equal(written[0].payload?.confidence, "verified", "which is what keeps dimension-aware fit switched on");
    assert.equal(written[0].payload?.floor_plan_asset_id, ASSET);
    assert.equal(written[0].payload?.wall_length_cm, 470);
    assert.equal(written[0].payload?.room_depth_cm, 320);

    const brief = h.briefWrites();
    assert.equal(brief.length, 1);
    const structured = brief[0].payload?.structured_json as Record<string, unknown>;
    assert.deepEqual(structured.floorPlan, { assetId: ASSET, label: "Living Room", box: detected[0].box });
    assert.ok(structured.visualPreferences, "and nothing else in the document is dropped");
  }

  // The villa brochure room: located, not sized. Confirming is still worth
  // something, because the crop is what the concept prompts need.
  {
    const h = confirmHarness();
    const outcome = await confirmDetectedRoom({ roomId: ROOM, roomIndex: 1, supabase: h.supabase });

    assert.deepEqual(outcome, { status: "confirmed", wroteMeasurements: false, recordedBox: true, label: "Family Room" });
    assert.equal(h.measurements().length, 0, "no size on the plan, no measurement invented");
    const structured = h.briefWrites()[0].payload?.structured_json as Record<string, unknown>;
    assert.deepEqual(structured.floorPlan, { assetId: ASSET, label: "Family Room", box: detected[1].box });
  }

  // A room the plan can do neither for is not confirmable at all.
  {
    const h = confirmHarness();
    assert.deepEqual(await confirmDetectedRoom({ roomId: ROOM, roomIndex: 2, supabase: h.supabase }), { status: "not_found" });
    assert.equal(h.measurements().length, 0);
    assert.equal(h.briefWrites().length, 0);
  }

  // The list she clicked belongs to a plan she has since replaced: nothing is
  // written, because one drawing's numbers against another drawing's id is the
  // silent wrong answer this guard exists for.
  {
    const h = confirmHarness({ assetId: "an-older-plan" });
    assert.deepEqual(await confirmDetectedRoom({ roomId: ROOM, roomIndex: 0, supabase: h.supabase }), { status: "stale" });
    assert.equal(h.measurements().length, 0);
    assert.equal(h.briefWrites().length, 0);
  }

  // Rejecting the crop keeps the numbers.
  {
    const h = confirmHarness({
      brief: { floorPlan: { assetId: ASSET, label: "Living Room", box: { x0: 0.1, y0: 0.1, x1: 0.5, y1: 0.5 } } }
    });
    await revertToWholePlan({ roomId: ROOM, supabase: h.supabase });

    const structured = h.briefWrites()[0].payload?.structured_json as Record<string, unknown>;
    assert.deepEqual(structured.floorPlan, { assetId: ASSET, label: "Living Room", box: null });
    assert.equal(h.measurements().length, 0, "and the measurement row is not touched");
  }

  console.log("floor plan read service tests passed");
}

void main();
