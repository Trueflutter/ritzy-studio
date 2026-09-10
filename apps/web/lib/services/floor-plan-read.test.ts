import assert from "node:assert/strict";

import { fakeSupabase, type RecordedCall } from "./supabase-test-double";
import { readFloorPlanForRoom } from "./floor-plan-read";

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
          read: { unitRead: "metres" as const, rooms },
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
    const output = closed[0].payload?.output_summary as { rooms: unknown[]; unitRead: string };
    assert.equal(output.unitRead, "metres");
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
          read: { unitRead: "unknown" as const, rooms: [] },
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
          read: { unitRead: "metres" as const, rooms },
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

  console.log("floor plan read service tests passed");
}

void main();
