import assert from "node:assert/strict";

import type {
  AssessRenderSpatialQualityInput,
  AssessRenderSpatialQualityResult,
  GenerateFinalGroundedRenderInput,
  GenerateFinalGroundedRenderResult,
  ReadRoomCameraFactsInput,
  ReadRoomCameraFactsResult
} from "@ritzy-studio/ai";
import type { RenderSpatialQaResponse } from "@ritzy-studio/prompts";

import { FINAL_RENDER_ATTEMPT_BUDGET_MS, FINAL_RENDER_INLINE_BUDGET_MS } from "./render";
import { SPATIAL_QA_RETRY_RESERVE_MS } from "./render-qa";
import { runFinalRender, type FinalRenderRunnerDeps } from "./render-runner";
import { fakeSupabase, type RecordedCall, type StorageCall } from "./services/supabase-test-double";

// S4 step 4 (AC 8): the runner with injected dependencies against the
// recording double. The claim, success and failure writes keep their filters;
// the success write carries the QA outcome, the camera read and the view plan;
// every paid call receives what is left of the attempt.

const passQa: RenderSpatialQaResponse = {
  focalOrientation: "pass",
  anchorAlignment: "pass",
  scalePlausibility: "pass",
  compositionIntegrity: "pass",
  zoning: "not_applicable",
  verdict: "pass",
  issues: []
};
const regenerateQa: RenderSpatialQaResponse = {
  ...passQa,
  scalePlausibility: "fail",
  verdict: "regenerate",
  issues: ["The rug floats away from the seating."]
};

type World = {
  jobStatus: string;
  successRows: Array<{ id: string }>;
  calls: RecordedCall[];
  storageCalls: StorageCall[];
};

function world(overrides: { jobStatus?: string; successRows?: Array<{ id: string }>; executionPath?: string } = {}) {
  const state: World = {
    jobStatus: overrides.jobStatus ?? "queued",
    successRows: overrides.successRows ?? [{ id: "job-1" }],
    calls: [],
    storageCalls: []
  };
  const photos = [
    { id: "photo-1", storage_path: "u/room-1/p1.jpg", mime_type: "image/jpeg", created_at: "2026-09-01T10:00:00Z" },
    { id: "photo-2", storage_path: "u/room-1/p2.jpg", mime_type: "image/jpeg", created_at: "2026-09-01T10:01:00Z" }
  ];
  const items = [
    {
      id: "item-sofa",
      category: "sofas",
      role_label: "anchor seating",
      selection_reason: null,
      unit_price_aed: 3000,
      sort_order: 1,
      spec_key: "0:sofa",
      product: {
        id: "p-sofa",
        name: "Curved Sofa",
        description: null,
        primary_image_url: "https://cdn.example.com/sofa.jpg",
        retailer: { name: "Home Centre", status: "active" },
        dimensions: []
      }
    }
  ];
  const { client, calls, storageCalls } = fakeSupabase(
    (call) => {
      if (call.table === "render_jobs" && call.op === "select") {
        return {
          data: {
            id: "job-1",
            room_id: "room-1",
            concept_id: "concept-1",
            shopping_list_id: "list-1",
            status: state.jobStatus,
            created_at: "2026-09-05T10:00:00Z",
            input_summary: {
              selectedShoppingItemIds: ["item-sofa"],
              userId: "user-1",
              revealPath: "/projects/proj-1/rooms/room-1/presentation",
              executionPath: overrides.executionPath ?? "queue"
            }
          }
        };
      }
      if (call.table === "render_jobs" && call.op === "update") {
        const payload = call.payload as { status?: string } | undefined;
        if (payload?.status === "running") {
          return { data: [{ id: "job-1" }] };
        }
        if (payload?.status === "succeeded") {
          return { data: state.successRows };
        }
        return { data: [{ id: "job-1" }] };
      }
      if (call.table === "rooms" && call.op === "select") {
        return { data: { id: "room-1", room_type: "Living Room", project_id: "proj-1" } };
      }
      if (call.table === "concepts") {
        return {
          data: {
            id: "concept-1",
            title: "Quiet Lounge",
            description: "Calm.",
            primary_image_asset: { storage_path: "u/room-1/concept-1.png", mime_type: "image/png" }
          }
        };
      }
      if (call.table === "room_assets" && call.op === "select") {
        return { data: photos };
      }
      if (call.table === "room_assets" && call.op === "insert") {
        return { data: { id: "asset-hero" } };
      }
      if (call.table === "room_design_specs") {
        return {
          data: {
            id: "spec-1",
            room_id: "room-1",
            concept_id: "concept-1",
            status: "confirmed",
            objects: [
              { role: "sofa", label: "curved sofa", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
              { role: "tv", label: "wall-mounted TV", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] },
              { role: "side_table", label: "side table", quantity: 1, sizeDescriptor: null, capacity: null, paletteMaterials: [] }
            ],
            must_preserve: ["the sliding doors"]
          }
        };
      }
      if (call.table === "shopping_list_items") {
        return { data: items };
      }
      if (call.table === "design_briefs") {
        return { data: { structured_json: { spatialIntent: { focalPoint: "tv_media_wall" } } } };
      }
      if (call.table === "ai_jobs" && call.op === "insert") {
        return { data: { id: `read-job-${calls.filter((entry) => entry.table === "ai_jobs" && entry.op === "insert").length}` } };
      }
      return { data: null };
    },
    (storageCall) =>
      storageCall.op === "download"
        ? { data: new Blob([Buffer.from(storageCall.path)]) }
        : storageCall.op === "createSignedUrl"
          ? { data: { signedUrl: `https://project.supabase.co/signed/${storageCall.path}` } }
          : { data: null }
  );
  state.calls = calls;
  state.storageCalls = storageCalls;
  return { client, state };
}

function renderResult(id: string): GenerateFinalGroundedRenderResult {
  return {
    promptKey: "render.final_grounded_room",
    promptVersion: "2026-09-05.1",
    imageProvider: "evolink",
    imageModel: "gemini",
    imageLatencySeconds: 12,
    imageFallbackUsed: false,
    imageFallbackError: null,
    imageCreditsUsed: 20,
    imageBase64: Buffer.from(id).toString("base64"),
    revisedPrompt: null
  };
}

function cameraRead(showsFocalElement: boolean): ReadRoomCameraFactsResult {
  return {
    read: {
      source: "vision",
      hero: { showsFocalElement, hiddenRoleKeys: ["2:side_table"] },
      photos: [
        { assetId: "photo-1", sameRoom: "yes", cameraRelativeToHero: "same", showsFocalWall: showsFocalElement },
        { assetId: "photo-2", sameRoom: "yes", cameraRelativeToHero: "opposite", showsFocalWall: !showsFocalElement }
      ]
    },
    promptKey: "render.camera_read",
    promptVersion: "2026-09-05.1",
    model: "gpt-5-mini",
    textCostUsd: 0.003
  };
}

function qaResult(qa: RenderSpatialQaResponse): AssessRenderSpatialQualityResult {
  return { promptKey: "render.spatial_qa", promptVersion: "2026-09-05.1", model: "gpt-5-mini", textCostUsd: 0.01, qa };
}

type Probe = {
  renders: GenerateFinalGroundedRenderInput[];
  reads: ReadRoomCameraFactsInput[];
  qas: AssessRenderSpatialQualityInput[];
  revalidated: string[];
  views: Array<{ renderJobId: string; deadlineAt: number }>;
  clock: number;
};

function deps(
  client: unknown,
  options: {
    qaVerdicts?: RenderSpatialQaResponse[];
    renderCostMs?: number;
    renderThrows?: boolean;
    showsFocalElement?: boolean;
    viewsComplete?: boolean;
  } = {}
): { deps: Partial<FinalRenderRunnerDeps>; probe: Probe } {
  const probe: Probe = { renders: [], reads: [], qas: [], revalidated: [], views: [], clock: 1_000_000 };
  const verdicts = options.qaVerdicts ?? [passQa];
  return {
    probe,
    deps: {
      createServiceClient: async () => client as never,
      revalidatePath: async (path) => {
        probe.revalidated.push(path);
      },
      now: () => probe.clock,
      render: async (input) => {
        probe.renders.push(input);
        probe.clock += options.renderCostMs ?? 20_000;
        if (options.renderThrows) {
          throw new Error("provider down");
        }
        return renderResult(`render-${probe.renders.length}`);
      },
      readCamera: async (input) => {
        probe.reads.push(input);
        probe.clock += 3_000;
        return cameraRead(options.showsFocalElement ?? true);
      },
      assessQa: async (input) => {
        probe.qas.push(input);
        probe.clock += 5_000;
        return qaResult(verdicts[Math.min(probe.qas.length - 1, verdicts.length - 1)]);
      },
      fetchImage: async () => ({ bytes: Buffer.from("img"), mimeType: "image/jpeg" }),
      toVisionDataUrl: async (bytes) => `data:image/jpeg;base64,${bytes.toString("base64")}`,
      ensureViews: async ({ renderJobId, deadlineAt }) => {
        probe.views.push({ renderJobId, deadlineAt });
        return { complete: options.viewsComplete ?? true };
      }
    }
  };
}

function updates(state: World, status: string): RecordedCall[] {
  return state.calls.filter(
    (call) => call.table === "render_jobs" && call.op === "update" && (call.payload as { status?: string })?.status === status
  );
}

async function main() {
  // A. The hero passes first time. Filters on the claim and the success write
  // are the ones the queue contract relies on; the success write carries the
  // outcome, the read and the plan; the read has its own audit row; every paid
  // call received what was left of the attempt.
  {
    const { client, state } = world();
    const { deps: d, probe } = deps(client);
    const start = probe.clock;
    await runFinalRender({ renderJobId: "job-1", attempt: { mode: "queue", deliveryCount: 1 } }, d);

    const claim = updates(state, "running")[0];
    assert.ok(claim, "the claim write exists");
    assert.deepEqual(claim.filters, [["id", "job-1"]]);
    assert.deepEqual(claim.in, [["status", ["queued", "running"]]]);

    const success = updates(state, "succeeded")[0];
    assert.ok(success, "the success write exists");
    assert.deepEqual(success.filters, [["id", "job-1"], ["status", "running"]]);
    const summary = (success.payload as { input_summary: Record<string, unknown> }).input_summary;
    assert.equal(summary.spatialQaOutcome, "passed");
    assert.equal(summary.spatialQaRegenerated, false);
    assert.equal((summary.cameraRead as { source: string }).source, "vision");
    const plan = summary.viewPlan as { version: number; heroPhotoAssetId: string; views: Array<{ key: string; sourcePhotoAssetId: string | null }> };
    assert.equal(plan.version, 1);
    assert.equal(plan.heroPhotoAssetId, "photo-1");
    assert.deepEqual(plan.views.map((view) => view.key), ["reverse_wide", "anchor_detail"]);
    assert.equal(plan.views[0].sourcePhotoAssetId, "photo-2", "the opposite photograph anchors the reverse view");
    assert.equal(summary.roomPhotoCount, 2);
    assert.equal(summary.preservationContract, 1);
    assert.equal(summary.costEstimateUsd, 0.3041, "hero credits at 68 per USD plus the QA's text cost");
    assert.deepEqual(success.payload && (success.payload as { output_asset_ids: string[] }).output_asset_ids, ["asset-hero"]);

    // One render, one read on its own audit row, one QA, each bounded.
    assert.equal(probe.renders.length, 1);
    assert.ok(probe.renders[0].imageDeadlineMs !== undefined && probe.renders[0].imageDeadlineMs <= FINAL_RENDER_ATTEMPT_BUDGET_MS);
    assert.equal(probe.renders[0].additionalRoomPhotos?.length, 1);
    assert.deepEqual(probe.renders[0].mustPreserve, ["the sliding doors"]);
    assert.equal(probe.reads.length, 1);
    assert.ok(probe.reads[0].timeoutMs !== undefined && probe.reads[0].timeoutMs <= FINAL_RENDER_ATTEMPT_BUDGET_MS - (probe.clock - start));
    assert.deepEqual(probe.reads[0].photos.map((photo) => photo.assetId), ["photo-1", "photo-2"]);
    assert.deepEqual(probe.reads[0].keyRoles.map((role) => role.key), ["0:sofa", "2:side_table"], "the spec's sourceable roles, keyed");
    assert.equal(probe.qas.length, 1);
    assert.equal(probe.qas[0].cameraFacts?.focalElementInFrame, true);
    assert.ok(probe.qas[0].timeoutMs !== undefined && probe.qas[0].timeoutMs <= FINAL_RENDER_ATTEMPT_BUDGET_MS);
    const readRows = state.calls.filter((call) => call.table === "ai_jobs" && call.op === "insert");
    assert.equal(readRows.length, 1);
    assert.equal((readRows[0].payload as { job_type: string }).job_type, "render_camera_read");
    const readClose = state.calls.find((call) => call.table === "ai_jobs" && call.op === "update");
    assert.equal((readClose?.payload as { status: string; cost_estimate_usd: number }).status, "succeeded");
    assert.equal((readClose?.payload as { cost_estimate_usd: number }).cost_estimate_usd, 0.003);

    // The views phase ran under the same deadline; the reveal was revalidated.
    assert.equal(probe.views.length, 1);
    assert.equal(probe.views[0].deadlineAt, start + FINAL_RENDER_ATTEMPT_BUDGET_MS);
    assert.ok(probe.revalidated.includes("/projects/proj-1/rooms/room-1/presentation"));
    const roomUpdate = state.calls.find((call) => call.table === "rooms" && call.op === "update");
    assert.equal((roomUpdate?.payload as { status: string }).status, "rendering");
  }

  // B. Regenerate then pass: two renders (the second corrected), two reads on
  // two audit rows, the corrected render kept and its credits summed.
  {
    const { client, state } = world();
    const { deps: d, probe } = deps(client, { qaVerdicts: [regenerateQa, passQa] });
    await runFinalRender({ renderJobId: "job-1", attempt: { mode: "queue", deliveryCount: 1 } }, d);
    assert.equal(probe.renders.length, 2);
    assert.equal(probe.renders[0].promptSuffix, null);
    assert.match(probe.renders[1].promptSuffix ?? "", /The rug floats away from the seating/);
    assert.equal(probe.reads.length, 2);
    assert.equal(state.calls.filter((call) => call.table === "ai_jobs" && call.op === "insert").length, 2);
    const summary = (updates(state, "succeeded")[0].payload as { input_summary: Record<string, unknown> }).input_summary;
    assert.equal(summary.spatialQaOutcome, "resolved_after_regeneration");
    assert.equal(summary.spatialQaRegenerated, true);
    assert.equal(summary.imageCreditsUsed, 40);
    assert.deepEqual(summary.spatialQaVerdicts, ["regenerate", "pass"]);
  }

  // C. No time for a retry: a render that consumes the whole budget leaves a
  // regenerate verdict unresolved with the reason recorded, and the hero still
  // commits; the read and the QA were bounded by what was left.
  {
    const { client, state } = world();
    const { deps: d, probe } = deps(client, {
      qaVerdicts: [regenerateQa],
      renderCostMs: FINAL_RENDER_ATTEMPT_BUDGET_MS - SPATIAL_QA_RETRY_RESERVE_MS + 1_000
    });
    await runFinalRender({ renderJobId: "job-1", attempt: { mode: "queue", deliveryCount: 1 } }, d);
    assert.equal(probe.renders.length, 1);
    const summary = (updates(state, "succeeded")[0].payload as { input_summary: Record<string, unknown> }).input_summary;
    assert.equal(summary.spatialQaOutcome, "unresolved");
    assert.equal(summary.spatialQaReason, "no_time_for_retry");
    assert.ok(probe.reads[0].timeoutMs !== undefined && probe.reads[0].timeoutMs <= SPATIAL_QA_RETRY_RESERVE_MS);
    assert.ok(probe.qas[0].timeoutMs !== undefined && probe.qas[0].timeoutMs <= SPATIAL_QA_RETRY_RESERVE_MS);
  }

  // Review fixes. Inline mode can retry: a fast hero with a regenerate verdict
  // renders twice inside the inline budget. And a QA call that throws after a
  // successful camera read keeps that read for the plan, persisting the QA
  // error rather than a phantom read error.
  {
    const { client, state } = world({ executionPath: "inline" });
    const { deps: d, probe } = deps(client, { qaVerdicts: [regenerateQa, passQa] });
    await runFinalRender({ renderJobId: "job-1", attempt: { mode: "inline" } }, d);
    assert.equal(probe.renders.length, 2, "inline mode still gets its one bounded regeneration");
    const summary = (updates(state, "succeeded")[0].payload as { input_summary: Record<string, unknown> }).input_summary;
    assert.equal(summary.spatialQaOutcome, "resolved_after_regeneration");
  }
  {
    const { client, state } = world();
    const { deps: d, probe } = deps(client);
    d.assessQa = async (input) => {
      probe.qas.push(input);
      throw new Error("qa timed out");
    };
    await runFinalRender({ renderJobId: "job-1", attempt: { mode: "queue", deliveryCount: 1 } }, d);
    const summary = (updates(state, "succeeded")[0].payload as { input_summary: Record<string, unknown> }).input_summary;
    assert.equal(summary.spatialQaOutcome, "unreviewed");
    assert.match(String(summary.spatialQaError), /qa timed out/);
    assert.equal((summary.cameraRead as { source: string }).source, "vision", "the paid read survives the QA failure");
    assert.equal(summary.cameraReadError, null);
    const plan = summary.viewPlan as { views: Array<{ key: string; sourcePhotoAssetId: string | null }> };
    assert.equal(plan.views[0].key, "reverse_wide");
    assert.equal(plan.views[0].sourcePhotoAssetId, "photo-2");
  }

  // D. Inline mode, the render throws: the failure write, filtered on running,
  // carries the message; nothing rethrows; the inline budget applied.
  {
    const { client, state } = world({ executionPath: "inline" });
    const { deps: d, probe } = deps(client, { renderThrows: true });
    await runFinalRender({ renderJobId: "job-1", attempt: { mode: "inline" } }, d);
    const failure = updates(state, "failed")[0];
    assert.ok(failure, "the failure write exists");
    assert.deepEqual(failure.filters, [["id", "job-1"], ["status", "running"]]);
    assert.match((failure.payload as { error_message: string }).error_message, /provider down/);
    assert.equal(updates(state, "succeeded").length, 0);
    assert.ok(probe.renders[0].imageDeadlineMs !== undefined && probe.renders[0].imageDeadlineMs <= FINAL_RENDER_INLINE_BUDGET_MS);
  }

  // E. Queue mode below the attempt cap: a thrown render rethrows for
  // redelivery and writes no terminal status.
  {
    const { client, state } = world();
    const { deps: d } = deps(client, { renderThrows: true });
    await assert.rejects(
      runFinalRender({ renderJobId: "job-1", attempt: { mode: "queue", deliveryCount: 1 } }, d),
      /provider down/
    );
    assert.equal(updates(state, "failed").length, 0);
  }

  // F. A succeeded job on redelivery repairs only the views, with no claim and
  // no render, under a fresh deadline.
  {
    const { client, state } = world({ jobStatus: "succeeded" });
    const { deps: d, probe } = deps(client);
    await runFinalRender({ renderJobId: "job-1", attempt: { mode: "queue", deliveryCount: 2 } }, d);
    assert.equal(probe.renders.length, 0);
    assert.equal(updates(state, "running").length, 0);
    assert.equal(probe.views.length, 1);
    assert.equal(probe.views[0].deadlineAt, probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS);
  }

  // G. Reclaimed while rendering: the success write matches no row, the paid
  // image is removed and its asset row deleted, and nothing else is written.
  {
    const { client, state } = world({ successRows: [] });
    const { deps: d, probe } = deps(client);
    await runFinalRender({ renderJobId: "job-1", attempt: { mode: "queue", deliveryCount: 1 } }, d);
    assert.ok(state.storageCalls.some((call) => call.op === "remove" && call.bucket === "generated-renders"));
    assert.ok(state.calls.some((call) => call.table === "room_assets" && call.op === "delete"));
    assert.equal(state.calls.filter((call) => call.table === "rooms" && call.op === "update").length, 0);
    assert.equal(probe.views.length, 0);
  }

  // H. Incomplete views below the attempt cap rethrow for redelivery, after the
  // hero committed; on the final attempt they do not.
  {
    const { client } = world();
    const { deps: d } = deps(client, { viewsComplete: false });
    await assert.rejects(
      runFinalRender({ renderJobId: "job-1", attempt: { mode: "queue", deliveryCount: 1 } }, d),
      /requesting redelivery/
    );
    const last = world();
    const { deps: finalDeps } = deps(last.client, { viewsComplete: false });
    await runFinalRender({ renderJobId: "job-1", attempt: { mode: "queue", deliveryCount: 3 } }, finalDeps);
    assert.equal(updates(last.state, "succeeded").length, 1);
  }
}

main()
  .then(() => {
    console.log("render-runner tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
