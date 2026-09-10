import assert from "node:assert/strict";

import { fakeSupabase, type RecordedCall } from "./supabase-test-double";
import { confirmDetectedRoom, readFloorPlanForRoom, revertToWholePlan } from "./floor-plan-read";
import { roomImageInputs } from "./room-images";

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

  function confirmHarness({
    assetId = ASSET,
    brief = null,
    measurement = null
  }: {
    assetId?: string;
    brief?: Record<string, unknown> | null;
    measurement?: Record<string, unknown> | null;
  } = {}) {
    const calls: RecordedCall[] = [];
    const respond = (call: RecordedCall) => {
      calls.push(call);
      if (call.table === "room_measurements" && call.op === "select") {
        return { data: measurement };
      }
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

    assert.deepEqual(outcome, {
      status: "confirmed",
      wroteMeasurements: true,
      supersededAnotherRoom: false,
      recordedBox: true,
      label: "Living Room"
    });

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

    assert.deepEqual(outcome, {
      status: "confirmed",
      wroteMeasurements: false,
      supersededAnotherRoom: false,
      recordedBox: true,
      label: "Family Room"
    });
    assert.equal(h.measurements().length, 0, "no size on the plan, no measurement invented");
    const structured = h.briefWrites()[0].payload?.structured_json as Record<string, unknown>;
    assert.deepEqual(structured.floorPlan, { assetId: ASSET, label: "Family Room", box: detected[1].box });
  }

  // A plan does not print ceiling heights, so a row written from one alone
  // would blank a ceiling she typed. Every reader takes the newest row, so her
  // 300 would vanish from the form and the concept prompt would gain
  // "measurements were not provided" for a room that just got a better wall
  // length (review finding).
  {
    const h = confirmHarness({
      measurement: {
        wall_length_cm: 400,
        room_depth_cm: 300,
        ceiling_height_cm: 300,
        notes: "the alcove is 40 cm deep",
        source: "manual",
        floor_plan_asset_id: null
      }
    });
    await confirmDetectedRoom({ roomId: ROOM, roomIndex: 0, supabase: h.supabase });

    const written = h.measurements()[0].payload;
    assert.equal(written?.wall_length_cm, 470, "the plan's better number wins where the plan speaks");
    assert.equal(written?.ceiling_height_cm, 300, "and her ceiling survives where it does not");
    assert.equal(written?.notes, "the alcove is 40 cm deep");
  }

  // Changing her mind to a room the plan does not size must not leave the
  // first room's numbers as the newest row: the concept would then be sized to
  // a room it was never shown, under a crop and a name that say otherwise
  // (review finding).
  {
    const h = confirmHarness({
      measurement: {
        wall_length_cm: 470,
        room_depth_cm: 320,
        ceiling_height_cm: null,
        notes: null,
        source: "floor_plan",
        floor_plan_asset_id: ASSET
      }
    });
    const outcome = await confirmDetectedRoom({ roomId: ROOM, roomIndex: 1, supabase: h.supabase });

    assert.equal(outcome.status === "confirmed" && outcome.supersededAnotherRoom, true);
    const written = h.measurements()[0].payload;
    assert.equal(written?.wall_length_cm, null, "the other room's numbers go with it");
    assert.equal(written?.room_depth_cm, null);
    assert.equal(written?.confidence, "unknown", "a row with nothing to say does not claim to be verified");
    const structured = h.briefWrites()[0].payload?.structured_json as Record<string, unknown>;
    assert.deepEqual(structured.floorPlan, { assetId: ASSET, label: "Family Room", box: detected[1].box });
  }

  // But a shopper's own typed measurements are not another room's: confirming
  // a room the plan cannot size leaves them exactly where they are.
  {
    const h = confirmHarness({
      measurement: {
        wall_length_cm: 520,
        room_depth_cm: 410,
        ceiling_height_cm: 300,
        notes: null,
        source: "manual",
        floor_plan_asset_id: null
      }
    });
    await confirmDetectedRoom({ roomId: ROOM, roomIndex: 1, supabase: h.supabase });
    assert.equal(h.measurements().length, 0, "her own numbers are hers until she changes them");
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

  // ------------------------- what the concept path is actually handed (AC 4)
  //
  // The prompt receiving this asserts it is THIS room's plan, so the crop is
  // the thing that makes the sentence true once whole-home drawings are
  // invited. Driven end to end against the double with real bytes, because the
  // wiring is what a later edit drops (review finding).
  {
    const sharp = (await import("sharp")).default;
    const sheet = await sharp({
      create: { width: 2000, height: 1200, channels: 3, background: { r: 245, g: 244, b: 240 } }
    })
      .jpeg()
      .toBuffer();
    const photo = await sharp({
      create: { width: 800, height: 600, channels: 3, background: { r: 120, g: 110, b: 100 } }
    })
      .jpeg()
      .toBuffer();

    const planAsset = { id: ASSET, storage_path: "plan.jpg", mime_type: "image/jpeg" };

    async function inputsWith({ brief, assetId = ASSET }: { brief: unknown; assetId?: string }) {
      const respond = (call: RecordedCall) => {
        if (call.table === "room_assets") {
          const isPlan = call.filters.some(([, value]) => value === "floor_plan");
          return isPlan
            ? { data: { ...planAsset, id: assetId } }
            : { data: [{ id: "photo-1", storage_path: "photo.jpg", mime_type: "image/jpeg" }] };
        }
        if (call.table === "design_briefs") {
          return { data: { structured_json: brief } };
        }
        return { data: null };
      };
      const respondStorage = (call: { op: string; path: string }) =>
        call.op === "createSignedUrl"
          ? { data: { signedUrl: `https://example.test/${call.path}` } }
          : { data: new Blob([new Uint8Array(call.path === "plan.jpg" ? sheet : photo)]) };

      const { client } = fakeSupabase(respond, respondStorage as never);
      const inputs = await roomImageInputs(client as never, ROOM);
      const bytes = Buffer.from((inputs.floorPlanImageUrl ?? "").split(",")[1] ?? "", "base64");
      return bytes.length > 0 ? await sharp(bytes).metadata() : null;
    }

    const box = { x0: 0.1, y0: 0.1, x1: 0.35, y1: 0.9 };
    const confirmed = { assetId: ASSET, label: "Living Room", box };

    // Nothing confirmed: the whole sheet, landscape, as it has always been.
    const whole = await inputsWith({ brief: {} });
    assert.ok(whole && (whole.width ?? 0) > (whole.height ?? 0), "the sheet is landscape");

    // Confirmed, on the plan that is attached: her room, which is portrait.
    const cropped = await inputsWith({ brief: { floorPlan: confirmed } });
    assert.ok(
      cropped && (cropped.height ?? 0) > (cropped.width ?? 0),
      `the concept is handed the room, not the sheet: ${cropped?.width} by ${cropped?.height}`
    );

    // The plan she replaced says nothing about the plan she attached: cropping
    // by its box would cut a corner of somewhere else and call it her room.
    const replaced = await inputsWith({ brief: { floorPlan: confirmed }, assetId: "a-newer-plan" });
    assert.ok(replaced && (replaced.width ?? 0) > (replaced.height ?? 0), "back to the whole sheet");

    // Confirmed but never located (the villa brochure case): the whole drawing
    // stands, which is what it did before she confirmed.
    const located = await inputsWith({ brief: { floorPlan: { ...confirmed, box: null } } });
    assert.ok(located && (located.width ?? 0) > (located.height ?? 0));
  }

  console.log("floor plan read service tests passed");
}

void main();
