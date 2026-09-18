import assert from "node:assert/strict";

import { floorPlanRefused, floorPlanScreenState } from "@ritzy-studio/domain";

import { fakeSupabase, type RecordedCall } from "./supabase-test-double";
import {
  confirmDetectedRoom,
  floorPlanAssetInput,
  floorPlanJobInput,
  readFloorPlanForRoom,
  type FloorPlanAssetRow
} from "./floor-plan-read";
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

  // The predicates are the point, not the table names. Without them the newest
  // of a room's many ai_jobs rows (inspiration, concept, sourcing) would govern
  // the screen, and the newest inspiration photograph would be read as the
  // floor plan (review finding, mutation-verified).
  const asks = (call: RecordedCall, column: string, value: unknown) =>
    call.filters.some(([field, filterValue]) => field === column && filterValue === value);

  const respond = (call: RecordedCall) => {
    calls.push(call);
    if (call.table === "room_assets" && call.op === "select") {
      return { data: asks(call, "asset_type", "floor_plan") ? plan : null };
    }
    if (call.table === "ai_jobs" && call.op === "select") {
      return { data: asks(call, "job_type", "floor_plan_read") ? (job ?? null) : null };
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

  // The row says the plan is big; the file says otherwise. `mime_type`,
  // `width_px` and `height_px` are written by the browser and RLS lets an
  // owner write that row directly, so a forged 2400 by 1600 on a thumbnail
  // would buy a paid call criterion 14 says to refuse (cross-model review).
  {
    const sharp = (await import("sharp")).default;
    const thumbnail = await sharp({
      create: { width: 390, height: 578, channels: 3, background: { r: 250, g: 250, b: 250 } }
    })
      .jpeg()
      .toBuffer();

    const calls: RecordedCall[] = [];
    const { client } = fakeSupabase(
      (call) => {
        calls.push(call);
        if (call.table === "room_assets" && call.op === "select") {
          // What a forged row claims.
          return { data: { id: ASSET, storage_path: "p.jpg", mime_type: "image/jpeg", width_px: 2400, height_px: 1600 } };
        }
        if (call.table === "ai_jobs" && call.op === "select") {
          return { data: null };
        }
        if (call.table === "ai_jobs" && call.op === "insert") {
          return { data: { id: "job-1" } };
        }
        return { data: null };
      },
      () => ({ data: new Blob([new Uint8Array(thumbnail)]) })
    );

    const outcome = await readFloorPlanForRoom(
      { roomId: ROOM, userId: USER, supabase: client as never, serviceSupabase: client as never },
      {
        planDataUrl: async () => "data:image/jpeg;base64,PLAN",
        readPlan: async () => {
          throw new Error("must not be called");
        }
      }
    );

    assert.deepEqual(outcome, { status: "skipped", reason: "too_small" }, "the file is what decides, not the row");
    assert.equal(
      calls.filter((call) => call.table === "ai_jobs" && call.op === "insert").length,
      0,
      "and nothing is spent on it"
    );

    // And the row is corrected to the file, so the page refuses it too rather
    // than finding a large plan with no read against it (PR review).
    const corrected = calls.filter((call) => call.table === "room_assets" && call.op === "update");
    assert.equal(corrected.length, 1);
    assert.deepEqual(corrected[0].payload, { width_px: 390, height_px: 578 });
    assert.deepEqual(corrected[0].filters, [["id", ASSET]], "that plan's row and no other");
  }

  // PDF bytes declared as `image/png`, with a row to match. The format check
  // reads the row, which the browser wrote, so the only thing that can catch
  // this is the file itself: bytes no decoder can open are bytes no model can
  // read (cross-model gate, round three).
  {
    const calls: RecordedCall[] = [];
    const { client } = fakeSupabase(
      (call) => {
        calls.push(call);
        if (call.table === "room_assets" && call.op === "select") {
          return { data: { id: ASSET, storage_path: "p.png", mime_type: "image/png", width_px: 2400, height_px: 1600 } };
        }
        if (call.table === "ai_jobs" && call.op === "insert") {
          return { data: { id: "job-1" } };
        }
        return { data: null };
      },
      () => ({ data: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37])]) })
    );

    const outcome = await readFloorPlanForRoom(
      { roomId: ROOM, userId: USER, supabase: client as never, serviceSupabase: client as never },
      {
        planDataUrl: async () => "data:image/png;base64,NOTREALLY",
        readPlan: async () => {
          throw new Error("must not be called");
        }
      }
    );

    assert.deepEqual(outcome, { status: "skipped", reason: "unreadable_format" });
    assert.equal(calls.filter((call) => call.table === "ai_jobs" && call.op === "insert").length, 0, "nothing is spent");
  }

  // ----------------------- a refusal the page can see (PR review, P1)
  //
  // Bytes that are not an image, declared as one, on a plan nothing has read.
  // The read refused them and told nobody: the refusal was returned and not
  // written, so the refreshed page decided from what the browser had declared,
  // found a readable image with no read against it, and said "Reading your
  // floor plan" for ever with nothing to press. Driven here through the
  // mapping the page itself uses, on the rows as the read leaves them.
  const notImages = [
    {
      name: "PDF bytes saved as plan.png",
      bytes: new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0x25]),
      writes: "application/pdf",
      says: "pdf"
    },
    {
      name: "bytes no decoder recognises",
      bytes: new Uint8Array(Array.from({ length: 512 }, (_, i) => (i * 131 + 7) % 256)),
      writes: "application/octet-stream",
      says: "unreadable"
    }
  ] as const;

  for (const notImage of notImages) {
    // What the browser writes for a file it could not measure.
    let row: FloorPlanAssetRow = {
      id: ASSET,
      storage_path: "plan.png",
      mime_type: "image/png",
      width_px: null,
      height_px: null
    };
    const calls: RecordedCall[] = [];
    const { client, storageCalls } = fakeSupabase(
      (call) => {
        calls.push(call);
        if (call.table === "room_assets" && call.op === "select") {
          // The concept path asks for photographs and for the plan separately.
          const askedFor = call.filters.find(([field]) => field === "asset_type")?.[1];
          return askedFor === "room_photo"
            ? { data: [{ id: "photo-1", storage_path: "photo.jpg", mime_type: "image/jpeg" }] }
            : { data: row };
        }
        if (call.table === "design_briefs" && call.op === "select") {
          return { data: { structured_json: {} } };
        }
        if (call.table === "room_assets" && call.op === "update") {
          if (call.filters.some(([field, value]) => field === "id" && value === row.id)) {
            row = { ...row, ...(call.payload as Partial<FloorPlanAssetRow>) };
          }
          return { data: null };
        }
        if (call.table === "ai_jobs" && call.op === "insert") {
          return { data: { id: "job-1" } };
        }
        // No read has ever been made of this plan.
        return { data: null };
      },
      (call) =>
        call.op === "createSignedUrl"
          ? { data: { signedUrl: `https://example.test/${call.path}` } }
          : { data: new Blob([call.path === "photo.jpg" ? new Uint8Array([0xff, 0xd8, 0xff]) : notImage.bytes]) }
    );
    const pageState = () =>
      floorPlanScreenState({ asset: floorPlanAssetInput(row), newestJob: floorPlanJobInput(null), roomCount: 0 });
    const readIt = () =>
      readFloorPlanForRoom(
        { roomId: ROOM, userId: USER, supabase: client as never, serviceSupabase: client as never },
        {
          planDataUrl: async () => "data:image/png;base64,NOTREALLY",
          readPlan: async () => {
            throw new Error("must not be called");
          }
        }
      );

    // Before the read: a plan nothing has read is offered a read, not told
    // that one is under way. And the concept path, which decides by the same
    // column, sends these bytes to the model as an image, because
    // `visionImageDataUrl` falls back to the raw bytes when sharp cannot open
    // them.
    assert.equal(pageState(), "unread", `${notImage.name}: before`);
    assert.ok((await roomImageInputs(client as never, ROOM)).floorPlanImageUrl, `${notImage.name}: sent to concepts before`);

    assert.deepEqual(await readIt(), { status: "skipped", reason: "unreadable_format" }, notImage.name);

    // After: the page, from the rows alone, says the plan was refused and
    // which remedy applies. The upload panel calls it unusable, and replacing
    // it is the way on, since reading the same bytes again cannot succeed.
    assert.equal(row.mime_type, notImage.writes, `${notImage.name}: the row says what the file is`);
    assert.equal(pageState(), notImage.says, `${notImage.name}: an explicit refusal, on every load`);
    assert.ok(floorPlanRefused(pageState()), `${notImage.name}: and the upload panel agrees`);
    assert.equal(
      (await roomImageInputs(client as never, ROOM)).floorPlanImageUrl,
      null,
      `${notImage.name}: and the concept path leaves it out, rather than paying to send bytes no model can read`
    );

    // Asked again, the decision refuses from the row before it downloads
    // anything, so a refused plan costs one look at the file, once.
    const before = calls.length;
    const downloadsBefore = storageCalls.length;
    assert.deepEqual(await readIt(), { status: "skipped", reason: "unreadable_format" });
    assert.equal(
      calls.slice(before).filter((call) => call.op === "update" || call.op === "insert").length,
      0,
      `${notImage.name}: nothing written or spent the second time`
    );
    assert.equal(storageCalls.length, downloadsBefore, `${notImage.name}: and the file is not fetched again`);
  }

  // A correction that cannot be written is not swallowed: the page would go
  // on offering a read of a plan the read refuses.
  {
    const { client } = fakeSupabase(
      (call) => {
        if (call.table === "room_assets" && call.op === "select") {
          return { data: { id: ASSET, storage_path: "p.png", mime_type: "image/png", width_px: null, height_px: null } };
        }
        if (call.table === "room_assets" && call.op === "update") {
          return { error: { message: "permission denied for table room_assets" } };
        }
        return { data: null };
      },
      () => ({ data: new Blob([new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d])]) })
    );
    await assert.rejects(
      readFloorPlanForRoom({ roomId: ROOM, userId: USER, supabase: client as never, serviceSupabase: client as never }),
      /permission denied/
    );
  }

  // A plan the file check passes, on bytes a decoder opens. Every other read
  // here gets nothing from its storage double, so the check falls through as
  // "unavailable", and the branch every real read takes went unexercised: a
  // floor judged on the shorter edge refused the Emaar plan at the size Emaar
  // publishes it, and every suite passed (tests review).
  {
    const sharp = (await import("sharp")).default;
    const published = await sharp({
      create: { width: 1067, height: 550, channels: 3, background: { r: 250, g: 250, b: 250 } }
    })
      .jpeg()
      .toBuffer();
    const calls: RecordedCall[] = [];
    const { client } = fakeSupabase(
      (call) => {
        calls.push(call);
        if (call.table === "room_assets" && call.op === "select") {
          return { data: { id: ASSET, storage_path: "p.jpg", mime_type: "image/jpeg", width_px: 1067, height_px: 550 } };
        }
        if (call.table === "ai_jobs" && call.op === "insert") {
          return { data: { id: "job-1" } };
        }
        return { data: null };
      },
      () => ({ data: new Blob([new Uint8Array(published)]) })
    );
    const outcome = await readFloorPlanForRoom(
      { roomId: ROOM, userId: USER, supabase: client as never, serviceSupabase: client as never },
      {
        planDataUrl: async () => "data:image/jpeg;base64,PLAN",
        readPlan: async () => ({
          read: { unitRead: "metres" as const, rooms, roomsFound: rooms.length },
          promptKey: "brief.floor_plan_read",
          promptVersion: "2026-09-10.2",
          model: "gpt-5-mini",
          textCostUsd: 0.004
        })
      }
    );
    assert.equal(outcome.status, "read", "a plan as wide as a developer publishes it is read");
    assert.equal(calls.filter((call) => call.table === "ai_jobs" && call.op === "insert").length, 1);
    assert.equal(
      calls.filter((call) => call.table === "room_assets" && call.op === "update").length,
      0,
      "and a plan the file check passes is left as the browser described it"
    );
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
    { label: "Store", level: null, wallLengthCm: null, roomDepthCm: null, ceilingHeightCm: null }
  ];

  function confirmHarness({
    assetId = ASSET,
    brief = null,
    measurement = null,
    jobStatus = "succeeded"
  }: {
    assetId?: string;
    brief?: Record<string, unknown> | null;
    measurement?: Record<string, unknown> | null;
    jobStatus?: string;
  } = {}) {
    const calls: RecordedCall[] = [];
    const asks = (call: RecordedCall, column: string, value: unknown) =>
      call.filters.some(([field, filterValue]) => field === column && filterValue === value);
    const respond = (call: RecordedCall) => {
      calls.push(call);
      if (call.table === "room_measurements" && call.op === "select") {
        return { data: measurement };
      }
      if (call.table === "room_assets") {
        return {
          data: asks(call, "asset_type", "floor_plan")
            ? { id: ASSET, storage_path: "p.png", mime_type: "image/png", width_px: 2400, height_px: 1700 }
            : null
        };
      }
      if (call.table === "ai_jobs" && call.op === "select") {
        return {
          data: asks(call, "job_type", "floor_plan_read")
            ? { id: "read-1", status: jobStatus, input_summary: { assetId }, output_summary: { rooms: detected } }
            : null
        };
      }
      if (call.table === "design_briefs" && call.op === "select") {
        return { data: brief ? { id: "brief-1", structured_json: brief, updated_at: "2026-09-10T10:00:00Z" } : null };
      }
      if (call.table === "design_briefs" && call.op === "update") {
        return { data: [{ id: "brief-1" }] };
      }
      if (call.table === "design_briefs" && call.op === "insert") {
        return { data: { id: "brief-1" } };
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
    const outcome = await confirmDetectedRoom({ roomId: ROOM, roomIndex: 0, readJobId: "read-1", supabase: h.supabase });

    assert.deepEqual(outcome, {
      status: "confirmed",
      wroteMeasurements: true,
      supersededAnotherRoom: false,
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
    assert.deepEqual(structured.floorPlan, { assetId: ASSET, label: "Living Room", index: 0 });
    assert.ok(structured.visualPreferences, "and nothing else in the document is dropped");
  }

  // The villa brochure room: located, not sized. Confirming is still worth
  // something, because the crop is what the concept prompts need.
  {
    const h = confirmHarness();
    const outcome = await confirmDetectedRoom({ roomId: ROOM, roomIndex: 1, readJobId: "read-1", supabase: h.supabase });

    assert.deepEqual(outcome, {
      status: "confirmed",
      wroteMeasurements: false,
      supersededAnotherRoom: false,
      label: "Family Room"
    });
    assert.equal(h.measurements().length, 0, "no size on the plan, no measurement invented");
    const structured = h.briefWrites()[0].payload?.structured_json as Record<string, unknown>;
    assert.deepEqual(structured.floorPlan, { assetId: ASSET, label: "Family Room", index: 1 });
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
    await confirmDetectedRoom({ roomId: ROOM, roomIndex: 0, readJobId: "read-1", supabase: h.supabase });

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
        // Carried into the previous confirmation from what she typed, which is
        // exactly what a first version dropped here. The fixture used to null
        // both fields, so it could not see the loss it sat on (review finding).
        ceiling_height_cm: 300,
        notes: "the alcove is 40 cm deep",
        source: "floor_plan",
        floor_plan_asset_id: ASSET
      }
    });
    const outcome = await confirmDetectedRoom({ roomId: ROOM, roomIndex: 1, readJobId: "read-1", supabase: h.supabase });

    assert.equal(outcome.status === "confirmed" && outcome.supersededAnotherRoom, true);
    const written = h.measurements()[0].payload;
    assert.equal(written?.wall_length_cm, null, "the other room's numbers go with it");
    assert.equal(written?.room_depth_cm, null);
    assert.equal(written?.ceiling_height_cm, 300, "but a ceiling is hers whichever room she picks");
    assert.equal(written?.notes, "the alcove is 40 cm deep", "and so is a note");
    assert.equal(written?.confidence, "unknown", "a row with nothing to say does not claim to be verified");
    const structured = h.briefWrites()[0].payload?.structured_json as Record<string, unknown>;
    assert.deepEqual(structured.floorPlan, { assetId: ASSET, label: "Family Room", index: 1 });
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
    await confirmDetectedRoom({ roomId: ROOM, roomIndex: 1, readJobId: "read-1", supabase: h.supabase });
    assert.equal(h.measurements().length, 0, "her own numbers are hers until she changes them");
  }

  // An index that is not an index. Server-action arguments are client
  // controlled and the TypeScript number is erased at runtime, so a crafted
  // one would index the array's prototype and hand back something that passes
  // a truth test: the insert then writes an all-null row at `verified` over
  // the measurements she typed (security review).
  for (const index of [3, -1, 1.5, Number.NaN, "constructor" as unknown as number]) {
    const h = confirmHarness();
    assert.deepEqual(
      await confirmDetectedRoom({ roomId: ROOM, roomIndex: index, readJobId: "read-1", supabase: h.supabase }),
      { status: "not_found" },
      `${String(index)} is not a room`
    );
    assert.equal(h.measurements().length, 0);
    assert.equal(h.briefWrites().length, 0);
  }

  // The list she clicked belongs to a plan she has since replaced: nothing is
  // written, because one drawing's numbers against another drawing's id is the
  // silent wrong answer this guard exists for.
  {
    const h = confirmHarness({ assetId: "an-older-plan" });
    assert.deepEqual(await confirmDetectedRoom({ roomId: ROOM, roomIndex: 0, readJobId: "read-1", supabase: h.supabase }), { status: "stale" });
    assert.equal(h.measurements().length, 0);
    assert.equal(h.briefWrites().length, 0);
  }

  // The list she clicked came from a different read than the one on record.
  // The check above cannot see it: Next runs server actions one at a time, so
  // a click on the old rooms during a replacement's read is sent only after
  // that read has landed, and by then the attached plan and the newest read
  // agree with each other. The old index would name a room on the new list,
  // written as `verified` under that room's name (PR review). A second tab
  // gets there with no queue at all.
  const staleReads: Array<{ name: string; jobStatus?: string; readJobId: unknown }> = [
    { name: "a list from the read before this one", readJobId: "read-0" },
    { name: "a read id that is not a string", readJobId: 1 },
    { name: "no read id at all", readJobId: undefined },
    { name: "a read that has not finished", jobStatus: "running", readJobId: "read-1" },
    { name: "a read that failed", jobStatus: "failed", readJobId: "read-1" }
  ];
  for (const stale of staleReads) {
    const h = confirmHarness({ jobStatus: stale.jobStatus });
    assert.deepEqual(
      await confirmDetectedRoom({ roomId: ROOM, roomIndex: 0, readJobId: stale.readJobId as string, supabase: h.supabase }),
      { status: "stale" },
      stale.name
    );
    assert.equal(h.measurements().length, 0, `${stale.name}: nothing measured`);
    assert.equal(h.briefWrites().length, 0, `${stale.name}: nothing recorded`);
  }

  // --------------------- what the concept path is actually told (criterion 4)
  //
  // No crop: the boxes came back plausible and wrong on a real plan. What
  // travels instead is the NAME she confirmed, which the read is reliable at,
  // and `floorPlanLanguage` turns it into a sentence that stops asserting a
  // whole-home drawing is her room.
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

    async function inputsWith({ brief, assetId = ASSET }: { brief: unknown; assetId?: string }) {
      const respond = (call: RecordedCall) => {
        if (call.table === "room_assets") {
          const isPlan = call.filters.some(([, value]) => value === "floor_plan");
          return isPlan
            ? { data: { id: assetId, storage_path: "plan.jpg", mime_type: "image/jpeg" } }
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
      return roomImageInputs(client as never, ROOM);
    }

    const confirmed = { assetId: ASSET, label: "Living Room", index: 0 };

    const none = await inputsWith({ brief: {} });
    assert.ok(none.floorPlanImageUrl, "the plan still reaches the model");
    assert.equal(none.floorPlanRoomLabel, null, "and the prompt is told nothing it cannot know");

    const named = await inputsWith({ brief: { floorPlan: confirmed } });
    assert.equal(named.floorPlanRoomLabel, "Living Room");

    // The room she picked off a plan she has since replaced says nothing about
    // the plan attached now.
    const replaced = await inputsWith({ brief: { floorPlan: confirmed }, assetId: "a-newer-plan" });
    assert.equal(replaced.floorPlanRoomLabel, null);
  }

  // ------------------------ two writers, one document (P1 from the PR review)
  //
  // `saveDesignBriefAction` reads this column, merges and writes the whole
  // object back; so does the confirmation. She can press Continue while a
  // confirmation is in flight, and the interleaving loses whichever write read
  // first: her typed answers, or the room she just picked.
  {
    const calls: RecordedCall[] = [];
    // The other writer lands between our read and our write: her colour note
    // arrives, and the row's updated_at moves with it.
    let brief: Record<string, unknown> = { visualPreferences: { likedStyleSlugs: ["quiet-luxury"] } };
    let updatedAt = "2026-09-10T10:00:00Z";
    let updates = 0;

    const asks = (call: RecordedCall, column: string, value: unknown) =>
      call.filters.some(([field, filterValue]) => field === column && filterValue === value);

    const { client } = fakeSupabase((call) => {
      calls.push(call);
      if (call.table === "room_assets") {
        return {
          data: asks(call, "asset_type", "floor_plan")
            ? { id: ASSET, storage_path: "p.png", mime_type: "image/png", width_px: 2400, height_px: 1700 }
            : null
        };
      }
      if (call.table === "ai_jobs" && call.op === "select") {
        return {
          data: asks(call, "job_type", "floor_plan_read")
            ? { id: "read-1", status: "succeeded", input_summary: { assetId: ASSET }, output_summary: { rooms: detected } }
            : null
        };
      }
      if (call.table === "room_measurements") {
        return { data: null };
      }
      if (call.table === "design_briefs" && call.op === "select") {
        return { data: { id: "brief-1", structured_json: brief, updated_at: updatedAt } };
      }
      if (call.table === "design_briefs" && call.op === "update") {
        updates += 1;
        // The first write is guarded on a value the other writer has already
        // moved past, so PostgREST matches nothing.
        if (asks(call, "updated_at", "2026-09-10T10:00:00Z")) {
          brief = { ...brief, colourNote: "cool limestone and pale oak" };
          updatedAt = "2026-09-10T10:00:05Z";
          return { data: [] };
        }
        return { data: [{ id: "brief-1" }] };
      }
      return { data: null };
    });

    const outcome = await confirmDetectedRoom({ roomId: ROOM, roomIndex: 0, readJobId: "read-1", supabase: client as never });
    assert.equal(outcome.status, "confirmed");
    assert.equal(updates, 2, "the guarded write lost once and was retried");

    const written = calls.filter((call) => call.table === "design_briefs" && call.op === "update");
    assert.ok(
      written.every((call) => call.filters.some(([field]) => field === "updated_at")),
      "every write is guarded on the version it read"
    );
    const final = written[1].payload?.structured_json as Record<string, unknown>;
    assert.deepEqual(final.floorPlan, { assetId: ASSET, label: "Living Room", index: 0 }, "the room she picked survives");
    assert.equal(final.colourNote, "cool limestone and pale oak", "and so does what the other writer saved");
    assert.ok(final.visualPreferences, "along with everything that was already there");
  }

  console.log("floor plan read service tests passed");
}

void main();
