import assert from "node:assert/strict";

import type {
  AssessViewConsistencyInput,
  AssessViewConsistencyResult,
  GenerateFinalRenderViewInput,
  GenerateFinalRenderViewResult
} from "@ritzy-studio/ai";
import type { ViewPlan } from "@ritzy-studio/domain";

import { FINAL_RENDER_ATTEMPT_BUDGET_MS } from "./render";
import {
  ensureFinalRenderViews,
  RENDER_VIEW_CHECK_JOB_TYPE,
  VIEW_LEASE_GRACE_MS,
  VIEW_LEASE_MS,
  VIEW_START_RESERVE_MS,
  type FinalRenderViewsDeps
} from "./render-views";
import { fakeSupabase, type RecordedCall, type StorageCall } from "./services/supabase-test-double";

// S4 step 5 (AC 7): the views phase against the recording double. A lease row
// before every paid call, attempt-unique view paths, the one succeeded row per
// key as the winner, the versioned asset-list write, and the two legacy cases.

type CheckRow = {
  id: string;
  status: string;
  created_at: string;
  input_summary: Record<string, unknown>;
  output_summary: Record<string, unknown> | null;
};

type ViewAsset = { id: string; storage_path: string; view_key: string | null; mime_type: string };

const plan: ViewPlan = {
  version: 1,
  heroPhotoAssetId: "photo-1",
  heroReferenceItemIds: ["item-sofa"],
  views: [
    {
      key: "focal_wide",
      label: "Focal wall view",
      purpose: "Show the TV wall.",
      sourcePhotoAssetId: "photo-2",
      mustShow: ["focal:tv_media_wall", "5:media_console"],
      mustShowLabels: ["the TV and media wall (wall-mounted TV)", "low media console"],
      referenceItemIds: ["item-console", "item-sofa"],
      photoNotes: []
    },
    {
      key: "anchor_detail",
      label: "Detail view",
      purpose: "Materials up close.",
      sourcePhotoAssetId: null,
      mustShow: [],
      mustShowLabels: [],
      referenceItemIds: ["item-lamp"],
      photoNotes: []
    }
  ],
  designLabels: ["wall-mounted TV", "low media console", "crystal chandelier"],
  coverage: {
    focalToken: "focal:tv_media_wall",
    focalCoveredBy: "focal_wide",
    keyRoleKeys: ["0:sofa", "5:media_console"],
    heroCovers: ["0:sofa"],
    uncovered: []
  }
};

function scenario(options: {
  plan?: ViewPlan | null;
  checkRows?: CheckRow[];
  viewAssets?: ViewAsset[];
  leaseInsertError?: { code: string; message: string } | null;
  versionMissesBeforeSuccess?: number;
  // What another delivery recorded, visible only after a version miss.
  outcomesRecordedByOther?: Record<string, { outcome: string; assetId: string }>;
  closeErrorsBeforeSuccess?: number;
  uploadError?: string;
  jobReadError?: string;
  listWriteError?: string;
  viewsVersion?: number | null;
  jobStatus?: string;
  outputAssetIds?: string[];
} = {}) {
  const state = {
    checkRows: options.checkRows ?? [],
    viewAssets: options.viewAssets ?? [],
    inserted: [] as RecordedCall[],
    versionMisses: options.versionMissesBeforeSuccess ?? 0,
    missed: false,
    closeErrors: options.closeErrorsBeforeSuccess ?? 0,
    versionWrites: [] as RecordedCall[],
    viewsVersion: options.viewsVersion === undefined ? 0 : options.viewsVersion,
    outputAssetIds: options.outputAssetIds ?? ["asset-hero"],
    calls: [] as RecordedCall[],
    storageCalls: [] as StorageCall[],
    nextId: 1
  };
  const jobRow = () => ({
    id: "job-1",
    room_id: "room-1",
    concept_id: "concept-1",
    status: options.jobStatus ?? "succeeded",
    output_asset_ids: state.outputAssetIds,
    input_summary: {
      userId: "user-1",
      revealPath: "/projects/proj-1/rooms/room-1/presentation",
      ...(options.plan === null ? {} : { viewPlan: options.plan ?? plan }),
      ...(state.viewsVersion === null ? {} : { viewsVersion: state.viewsVersion }),
      ...(state.missed && options.outcomesRecordedByOther ? { viewOutcomes: options.outcomesRecordedByOther } : {})
    }
  });
  const items = [
    { id: "item-sofa", role_label: "anchor seating", product: { id: "p-sofa", name: "Curved Sofa", primary_image_url: "https://cdn.example.com/sofa.jpg" } },
    { id: "item-console", role_label: "media console", product: { id: "p-console", name: "Low Console", primary_image_url: "https://cdn.example.com/console.jpg" } },
    { id: "item-lamp", role_label: "floor lamp", product: { id: "p-lamp", name: "Arc Lamp", primary_image_url: null } }
  ];
  const { client, calls, storageCalls } = fakeSupabase(
    (call) => {
      if (call.table === "render_jobs" && call.op === "select") {
        if (options.jobReadError) {
          return { error: { message: options.jobReadError } };
        }
        return { data: jobRow() };
      }
      if (call.table === "render_jobs" && call.op === "update") {
        state.versionWrites.push(call);
        if (options.listWriteError) {
          return { error: { message: options.listWriteError } };
        }
        if (state.versionMisses > 0) {
          state.versionMisses -= 1;
          state.missed = true;
          state.viewsVersion = (state.viewsVersion ?? 0) + 1;
          return { data: [] };
        }
        const payload = call.payload as { output_asset_ids?: string[]; input_summary?: { viewsVersion?: number } };
        state.outputAssetIds = payload.output_asset_ids ?? state.outputAssetIds;
        state.viewsVersion = payload.input_summary?.viewsVersion ?? state.viewsVersion;
        return { data: [{ id: "job-1" }] };
      }
      if (call.table === "rooms") {
        return { data: { id: "room-1", room_type: "Living Room", project_id: "proj-1" } };
      }
      if (call.table === "concepts") {
        return { data: { id: "concept-1", title: "Quiet Lounge", description: "Calm." } };
      }
      if (call.table === "room_assets" && call.op === "select") {
        const byId = call.filters.find(([column]) => column === "id")?.[1] as string | undefined;
        if (byId === "asset-hero") {
          return { data: { id: "asset-hero", storage_path: "u/room-1/final-job-1-abcd1234.png", mime_type: "image/png" } };
        }
        if (byId === "photo-2") {
          return { data: { id: "photo-2", storage_path: "u/room-1/p2.jpg", mime_type: "image/jpeg" } };
        }
        if (byId) {
          return { data: state.viewAssets.find((asset) => asset.id === byId) ?? null };
        }
        return { data: state.viewAssets };
      }
      if (call.table === "room_assets" && call.op === "insert") {
        const payload = call.payload as { storage_path: string; view_key: string | null };
        const id = `view-asset-${state.nextId++}`;
        state.viewAssets.push({ id, storage_path: payload.storage_path, view_key: payload.view_key, mime_type: "image/png" });
        return { data: { id } };
      }
      if (call.table === "ai_jobs" && call.op === "select") {
        const byId = call.filters.find(([column]) => column === "id")?.[1] as string | undefined;
        if (byId) {
          return { data: state.checkRows.find((row) => row.id === byId) ?? null };
        }
        // The phase scopes its read to the render job; the double honours the
        // contains filter so a row of another job is never handed back.
        const wanted = call.contains.find(([column]) => column === "input_summary")?.[1] as Record<string, unknown> | undefined;
        const scoped = state.checkRows.filter(
          (row) => !wanted || Object.entries(wanted).every(([key, value]) => (row.input_summary as Record<string, unknown>)[key] === value)
        );
        return { data: [...scoped].sort((left, right) => (left.created_at < right.created_at ? 1 : -1)) };
      }
      if (call.table === "ai_jobs" && call.op === "insert") {
        state.inserted.push(call);
        const payload = call.payload as { job_type: string; input_summary: Record<string, unknown> };
        if (payload.job_type === RENDER_VIEW_CHECK_JOB_TYPE && options.leaseInsertError) {
          return { error: options.leaseInsertError as never };
        }
        const id = `row-${state.nextId++}`;
        if (payload.job_type === RENDER_VIEW_CHECK_JOB_TYPE) {
          state.checkRows.push({ id, status: "running", created_at: new Date(state.nextId * 1000).toISOString(), input_summary: payload.input_summary, output_summary: null });
        }
        return { data: { id } };
      }
      if (call.table === "ai_jobs" && call.op === "update") {
        const id = call.filters.find(([column]) => column === "id")?.[1] as string;
        const requiredStatus = call.filters.find(([column]) => column === "status")?.[1] as string | undefined;
        const row = state.checkRows.find((entry) => entry.id === id);
        const payload = call.payload as { status?: string; output_summary?: Record<string, unknown>; input_summary?: Record<string, unknown> };
        if (payload.status === "succeeded" && state.closeErrors > 0) {
          state.closeErrors -= 1;
          return { error: { message: "pooler blip" } };
        }
        if (row && requiredStatus && row.status !== requiredStatus) {
          return { data: [] };
        }
        if (row) {
          if (payload.status) row.status = payload.status;
          if (payload.output_summary) row.output_summary = { ...(row.output_summary ?? {}), ...payload.output_summary };
          if (payload.input_summary) row.input_summary = payload.input_summary;
        }
        return { data: [{ id }] };
      }
      if (call.table === "shopping_list_items") {
        const ids = call.in.find(([column]) => column === "id")?.[1] as string[];
        return { data: items.filter((item) => ids.includes(item.id)) };
      }
      return { data: null };
    },
    (storageCall) =>
      storageCall.op === "download"
        ? { data: new Blob([Buffer.from(storageCall.path)]) }
        : storageCall.op === "createSignedUrl"
          ? { data: { signedUrl: `https://project.supabase.co/signed/${storageCall.path}` } }
          : storageCall.op === "upload" && options.uploadError
            ? { error: { message: options.uploadError } }
            : { data: null }
  );
  state.calls = calls;
  state.storageCalls = storageCalls;
  return { client, state };
}

function consistent(overrides: Partial<AssessViewConsistencyResult["check"]> = {}): AssessViewConsistencyResult {
  return {
    check: {
      architectureConsistent: true,
      cameraMatchesAnchor: "not_applicable",
      sharedObjectsConsistent: true,
      expectedShown: [],
      expectedMissing: [],
      invented: [],
      verdict: "consistent",
      issues: [],
      ...overrides
    },
    promptKey: "render.view_consistency",
    promptVersion: "2026-09-05.1",
    model: "gpt-5-mini",
    textCostUsd: 0.003
  };
}

const inconsistent = () => consistent({ sharedObjectsConsistent: false, verdict: "inconsistent", issues: ["The sofa changed colour."] });

function viewResult(key: string, index: number): GenerateFinalRenderViewResult {
  return {
    viewKey: key as never,
    promptVersion: "final-render-view.2026-09-05.1",
    imageProvider: "evolink",
    imageModel: "gemini",
    imageLatencySeconds: 9,
    imageFallbackUsed: false,
    imageFallbackError: null,
    imageCreditsUsed: 20,
    imageBase64: Buffer.from(`${key}-${index}`).toString("base64")
  };
}

type Probe = {
  generations: GenerateFinalRenderViewInput[];
  assessments: AssessViewConsistencyInput[];
  clock: number;
  order: string[];
};

function deps(
  options: {
    checks?: Array<AssessViewConsistencyResult | Error>;
    // Per view key, because the views run in parallel and a shared sequence
    // would be consumed in arrival order.
    checksByKey?: Record<string, Array<AssessViewConsistencyResult | Error>>;
    generateThrows?: boolean;
    generateCostMs?: number;
  } = {}
): { deps: FinalRenderViewsDeps; probe: Probe } {
  const probe: Probe = { generations: [], assessments: [], clock: 1_000_000, order: [] };
  const checks = options.checks ?? [consistent()];
  const consumedByKey = new Map<string, number>();
  let nonce = 0;
  return {
    probe,
    deps: {
      now: () => probe.clock,
      sleep: async (ms) => {
        probe.order.push(`sleep:${ms}`);
        probe.clock += ms;
      },
      generateView: async (input) => {
        probe.generations.push(input);
        probe.order.push(`generate:${input.viewKey}`);
        probe.clock += options.generateCostMs ?? 20_000;
        if (options.generateThrows) {
          throw new Error("provider down");
        }
        return viewResult(input.viewKey, probe.generations.length);
      },
      assessView: async (input) => {
        probe.assessments.push(input);
        probe.order.push(`assess:${input.viewKey}`);
        probe.clock += 3_000;
        const sequence = options.checksByKey?.[input.viewKey] ?? checks;
        const consumed = consumedByKey.get(input.viewKey) ?? 0;
        consumedByKey.set(input.viewKey, consumed + 1);
        const next = sequence[Math.min(consumed, sequence.length - 1)];
        if (next instanceof Error) {
          throw next;
        }
        return next;
      },
      fetchImage: async (url) => ({ bytes: Buffer.from(url), mimeType: "image/jpeg" }),
      toVisionDataUrl: async (bytes) => `data:image/png;base64,${bytes.toString("base64")}`,
      nonce: () => `n${(nonce += 1)}`
    }
  };
}

function inserts(state: ReturnType<typeof scenario>["state"], jobType: string) {
  return state.inserted.filter((call) => (call.payload as { job_type: string }).job_type === jobType);
}

async function main() {
  // (i) A fresh delivery with a persisted plan: a lease row is opened before
  // every paid generation, views upload to attempt-unique paths with their
  // own asset rows, each check row closes succeeded naming the asset it
  // judged, and the asset list is written under the version that was read.
  {
    const { client, state } = scenario();
    const { deps: d, probe } = deps();
    const result = await ensureFinalRenderViews({
      serviceSupabase: client as never,
      renderJobId: "job-1",
      deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS,
      now: d.now,
      deps: d
    });
    assert.equal(result.complete, true);
    assert.equal(inserts(state, "render_camera_read").length, 0, "the views phase never reads the camera");
    const leases = inserts(state, RENDER_VIEW_CHECK_JOB_TYPE);
    assert.equal(leases.length, 2);
    const leaseIndex = state.calls.findIndex((call) => call.table === "ai_jobs" && call.op === "insert");
    const firstUpload = state.storageCalls.findIndex((call) => call.op === "upload");
    assert.ok(leaseIndex >= 0 && firstUpload >= 0, "a lease and an upload both happened");
    assert.equal((leases[0].payload as { status: string }).status, "running");
    const leaseSummary = (leases[0].payload as { input_summary: Record<string, unknown> }).input_summary;
    assert.equal(leaseSummary.renderJobId, "job-1");
    assert.ok(typeof leaseSummary.leaseUntil === "number" && (leaseSummary.leaseUntil as number) > 1_000_000);
    assert.ok((leaseSummary.leaseUntil as number) <= 1_000_000 + VIEW_LEASE_MS, "a lease is bounded by the view's own worst case, not the attempt");
    assert.deepEqual(probe.order.slice(0, 4).filter((entry) => entry.startsWith("generate")).length, 2);

    // Generation inputs: the focal view is anchored to photo-2, carries its
    // products and labels; the detail view is unanchored.
    const focal = probe.generations.find((input) => input.viewKey === "focal_wide");
    assert.ok(focal?.sourcePhoto, "the focal view is anchored to its photograph");
    assert.equal(focal?.sourcePhoto?.bytes.toString(), "u/room-1/p2.jpg");
    assert.equal(focal?.productReferences?.length, 2);
    assert.deepEqual(focal?.mustShowLabels, ["the TV and media wall (wall-mounted TV)", "low media console"]);
    assert.equal(focal?.focalLabel, "the TV and media wall");
    assert.ok(
      focal?.deadlineMs !== undefined && focal.deadlineMs <= VIEW_LEASE_MS - VIEW_LEASE_GRACE_MS && focal.deadlineMs < FINAL_RENDER_ATTEMPT_BUDGET_MS,
      "a view's image call is bounded by its lease, not by the attempt (Codex finding)"
    );
    const viewCloses = state.calls.filter(
      (call) => call.table === "ai_jobs" && call.op === "update" && typeof (call.payload as { output_summary?: { viewKey?: string } }).output_summary?.viewKey === "string" && (call.payload as { status?: string }).status === "succeeded"
    );
    assert.equal(viewCloses.length, 2);
    assert.ok(viewCloses.every((call) => call.filters.some(([column, value]) => column === "status" && value === "running")), "every close is filtered on status = running");
    assert.deepEqual(
      probe.assessments.find((input) => input.viewKey === "focal_wide")?.designLabels,
      plan.designLabels,
      "the consistency judge holds the design vocabulary"
    );
    // Review finding: the judge is handed, and hands back, the composed
    // focal label the plan put in this view's expected list; the verdict's
    // own comparison must see the same string, not the bare element label.
    assert.equal(
      probe.assessments.find((input) => input.viewKey === "focal_wide")?.focalLabel,
      "the TV and media wall (wall-mounted TV)",
      "the focal label the judge sees is the composed expected entry"
    );
    assert.equal(probe.assessments.find((input) => input.viewKey === "anchor_detail")?.focalLabel, null, "a view not carrying the focal token is not judged against it");
    const detail = probe.generations.find((input) => input.viewKey === "anchor_detail");
    assert.equal(detail?.sourcePhoto ?? null, null);
    assert.equal(detail?.productReferences?.length, 0, "a product without an image is not a reference");

    // Assessments: the anchored photograph and the expected labels travel to the check.
    const focalCheck = probe.assessments.find((input) => input.viewKey === "focal_wide");
    assert.ok(focalCheck?.anchorPhotoDataUrl);
    assert.deepEqual(focalCheck?.expectedLabels, ["the TV and media wall (wall-mounted TV)", "low media console"]);
    assert.ok(focalCheck?.timeoutMs !== undefined && focalCheck.timeoutMs <= FINAL_RENDER_ATTEMPT_BUDGET_MS);

    // Attempt-unique paths, one asset row per view, view_key set.
    const uploads = state.storageCalls.filter((call) => call.op === "upload").map((call) => call.path);
    assert.equal(uploads.length, 2);
    assert.ok(uploads.every((path) => /final-job-1-(focal_wide|anchor_detail)-n\d+\.png$/.test(path)));
    assert.equal(state.viewAssets.length, 2);
    assert.ok(state.viewAssets.every((asset) => asset.view_key !== null));

    // Each check row closed succeeded, naming the asset it judged.
    const closed = state.checkRows.filter((row) => row.status === "succeeded");
    assert.equal(closed.length, 2);
    for (const row of closed) {
      assert.equal(row.output_summary?.outcome, "consistent");
      assert.ok(state.viewAssets.some((asset) => asset.id === row.output_summary?.assetId));
    }

    // The asset list: hero, then the winners in PLAN order (the views run in
    // parallel, so their asset ids do not say which came first), under the
    // version read.
    const assetFor = (key: string) => state.viewAssets.find((asset) => asset.view_key === key)!.id;
    const write = state.versionWrites[0];
    assert.deepEqual((write.payload as { output_asset_ids: string[] }).output_asset_ids, ["asset-hero", assetFor("focal_wide"), assetFor("anchor_detail")]);
    assert.ok(write.filters.some(([column, value]) => column === "status" && value === "succeeded"));
    assert.ok(write.filters.some(([column, value]) => column === "input_summary->>viewsVersion" && value === "0"));
    assert.equal((write.payload as { input_summary: { viewsVersion: number } }).input_summary.viewsVersion, 1);
    // The delivery's own views job closed succeeded with the spend.
    const viewsJob = inserts(state, "final_render_views");
    assert.equal(viewsJob.length, 1);
  }

  // (ii) A unique violation on the lease insert means another delivery owns
  // the key: zero generations, zero checks, not terminal.
  {
    const { client, state } = scenario({ leaseInsertError: { code: "23505", message: "duplicate key value" } });
    const { deps: d, probe } = deps();
    const result = await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d });
    assert.equal(probe.generations.length, 0);
    assert.equal(probe.assessments.length, 0);
    assert.equal(result.complete, false);
    assert.equal(state.storageCalls.filter((call) => call.op === "upload").length, 0);
  }

  // (iii) A running row inside its lease is skipped; (iv) one past its lease is
  // reclaimed by a status-conditional write before any spend, and when it had
  // recorded an asset that asset is checked without generating.
  {
    const now = 1_000_000;
    const { client, state } = scenario({
      viewAssets: [{ id: "view-asset-old", storage_path: "u/room-1/final-job-1-focal_wide-n9.png", view_key: "focal_wide", mime_type: "image/png" }],
      checkRows: [
        { id: "row-live", status: "running", created_at: "2026-09-05T10:00:00Z", input_summary: { renderJobId: "job-1", viewKey: "anchor_detail", leaseUntil: now + 100_000 }, output_summary: null },
        { id: "row-dead", status: "running", created_at: "2026-09-05T09:00:00Z", input_summary: { renderJobId: "job-1", viewKey: "focal_wide", leaseUntil: now - 1 }, output_summary: { assetId: "view-asset-old", assetPath: "u/room-1/final-job-1-focal_wide-n9.png" } }
      ]
    });
    const { deps: d, probe } = deps();
    const result = await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: now + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d });
    // focal_wide: the expired lease is reclaimed and its recorded asset is
    // checked, not regenerated. anchor_detail: the live lease is waited out
    // inside this attempt's budget, then reclaimed and generated.
    assert.equal(probe.generations.length, 1, "only the live-lease view is generated");
    assert.equal(probe.generations[0].viewKey, "anchor_detail");
    assert.ok(probe.order.some((entry) => entry.startsWith("sleep:")), "the live lease was waited out");
    assert.equal(probe.assessments.filter((input) => input.viewKey === "focal_wide").length, 1);
    const reclaim = state.calls.find((call) => call.table === "ai_jobs" && call.op === "update" && call.filters.some(([column, value]) => column === "id" && value === "row-dead") && (call.payload as { status?: string }).status === "failed");
    assert.ok(reclaim, "the expired lease was reclaimed");
    assert.ok(reclaim?.filters.some(([column, value]) => column === "status" && value === "running"));
    const reclaimIndex = state.calls.indexOf(reclaim!);
    const firstLeaseInsert = state.calls.findIndex((call) => call.table === "ai_jobs" && call.op === "insert" && (call.payload as { job_type: string }).job_type === RENDER_VIEW_CHECK_JOB_TYPE);
    assert.ok(reclaimIndex < firstLeaseInsert, "reclaim precedes the new lease");
    assert.equal(state.checkRows.find((row) => row.id === "row-live")?.status, "failed", "the dead holder's lease was reclaimed after it lapsed");
    assert.equal(result.complete, true, "both views are terminal after the wait");
    const newRow = state.checkRows.find((row) => row.status === "succeeded" && row.input_summary.viewKey === "focal_wide");
    assert.equal(newRow?.output_summary?.assetId, "view-asset-old");
  }

  // A live lease that the remaining budget cannot outwait is left alone and
  // the view is not terminal; and a holder that extended its lease while the
  // waiter slept is recognised as alive.
  {
    const now = 1_000_000;
    const { client, state } = scenario({
      checkRows: [
        { id: "row-live", status: "running", created_at: "2026-09-05T10:00:00Z", input_summary: { renderJobId: "job-1", viewKey: "anchor_detail", leaseUntil: now + 100_000 }, output_summary: null },
        { id: "row-focal", status: "succeeded", created_at: "2026-09-05T10:00:00Z", input_summary: { renderJobId: "job-1", viewKey: "focal_wide" }, output_summary: { outcome: "consistent", assetId: "va-focal" } }
      ],
      viewAssets: [{ id: "va-focal", storage_path: "u/room-1/final-job-1-focal_wide-n1.png", view_key: "focal_wide", mime_type: "image/png" }]
    });
    const { deps: d, probe } = deps();
    const result = await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: now + 100_000 + VIEW_START_RESERVE_MS - 1, now: d.now, deps: d });
    assert.equal(probe.generations.length, 0);
    assert.equal(result.complete, false);
    assert.equal(state.checkRows.find((row) => row.id === "row-live")?.status, "running");
  }

  // (v) Succeeded rows are winners; an unresolved one is excluded from the list;
  // nothing is generated or checked; the set is complete.
  {
    const { client, state } = scenario({
      viewAssets: [
        { id: "va-focal", storage_path: "u/room-1/final-job-1-focal_wide-n1.png", view_key: "focal_wide", mime_type: "image/png" },
        { id: "va-detail", storage_path: "u/room-1/final-job-1-anchor_detail-n2.png", view_key: "anchor_detail", mime_type: "image/png" }
      ],
      checkRows: [
        { id: "r1", status: "succeeded", created_at: "2026-09-05T10:00:00Z", input_summary: { renderJobId: "job-1", viewKey: "focal_wide" }, output_summary: { outcome: "consistent", assetId: "va-focal" } },
        { id: "r2", status: "succeeded", created_at: "2026-09-05T10:01:00Z", input_summary: { renderJobId: "job-1", viewKey: "anchor_detail" }, output_summary: { outcome: "unresolved", assetId: "va-detail" } }
      ]
    });
    const { deps: d, probe } = deps();
    const result = await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d });
    assert.equal(probe.generations.length, 0);
    assert.equal(probe.assessments.length, 0);
    assert.equal(result.complete, true);
    assert.deepEqual((state.versionWrites[0].payload as { output_asset_ids: string[] }).output_asset_ids, ["asset-hero", "va-focal"]);
  }

  // (vi) A legacy job (no plan) with both old-key assets present is adopted:
  // no generation, no check row, no read, its views in the list, complete.
  {
    const { client, state } = scenario({
      plan: null,
      viewsVersion: null,
      viewAssets: [
        { id: "old-reverse", storage_path: "user-1/room-1/final-job-1-reverse_wide.png", view_key: "reverse_wide", mime_type: "image/png" },
        { id: "old-detail", storage_path: "user-1/room-1/final-job-1-anchor_detail.png", view_key: "anchor_detail", mime_type: "image/png" }
      ]
    });
    const { deps: d, probe } = deps();
    const result = await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d });
    assert.equal(probe.generations.length, 0);
    assert.equal(probe.assessments.length, 0);
    assert.equal(inserts(state, RENDER_VIEW_CHECK_JOB_TYPE).length, 0);
    assert.equal(inserts(state, "render_camera_read").length, 0);
    assert.equal(result.complete, true);
    const write = state.versionWrites[0];
    assert.deepEqual((write.payload as { output_asset_ids: string[] }).output_asset_ids, ["asset-hero", "old-reverse", "old-detail"]);
    assert.ok(write.is.some(([column]) => column === "input_summary->>viewsVersion"), "a legacy job has no version yet");
  }

  // (vii) A legacy job missing one old-key asset generates exactly that view
  // through the lease, from the hero alone, to an attempt-unique path.
  {
    const { client, state } = scenario({
      plan: null,
      viewsVersion: null,
      viewAssets: [{ id: "old-reverse", storage_path: "user-1/room-1/final-job-1-reverse_wide.png", view_key: "reverse_wide", mime_type: "image/png" }]
    });
    const { deps: d, probe } = deps();
    const result = await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d });
    assert.equal(probe.generations.length, 1);
    assert.equal(probe.generations[0].viewKey, "anchor_detail");
    assert.equal(probe.generations[0].sourcePhoto ?? null, null);
    assert.equal(probe.generations[0].productReferences?.length ?? 0, 0);
    assert.equal(inserts(state, RENDER_VIEW_CHECK_JOB_TYPE).length, 1);
    assert.ok(state.storageCalls.some((call) => call.op === "upload" && /final-job-1-anchor_detail-n\d+\.png$/.test(call.path)));
    assert.equal(result.complete, true);
    const generatedDetail = state.viewAssets.find((asset) => asset.view_key === "anchor_detail" && asset.id !== "old-reverse")!.id;
    assert.deepEqual((state.versionWrites.at(-1)!.payload as { output_asset_ids: string[] }).output_asset_ids, ["asset-hero", "old-reverse", generatedDetail]);
  }

  // (viii) No budget to start a view: no row, not complete, nothing spent.
  {
    const { client, state } = scenario();
    const { deps: d, probe } = deps();
    const result = await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + VIEW_START_RESERVE_MS - 1, now: d.now, deps: d });
    assert.equal(probe.generations.length, 0);
    assert.equal(inserts(state, RENDER_VIEW_CHECK_JOB_TYPE).length, 0);
    assert.equal(result.complete, false);
  }

  // (ix) The asset-list write that matches no row is retried after a fresh
  // read, merging what the other delivery recorded with this delivery's own
  // outcomes; the retried payload is recomputed, not re-issued.
  {
    const { client, state } = scenario({
      checkRows: [
        { id: "r-focal", status: "succeeded", created_at: "2026-09-05T10:00:00Z", input_summary: { renderJobId: "job-1", viewKey: "focal_wide" }, output_summary: { outcome: "consistent", assetId: "va-focal" } },
        { id: "r-live", status: "running", created_at: "2026-09-05T10:01:00Z", input_summary: { renderJobId: "job-1", viewKey: "anchor_detail", leaseUntil: 1_000_000 + 100_000 }, output_summary: null }
      ],
      viewAssets: [{ id: "va-focal", storage_path: "u/room-1/final-job-1-focal_wide-n1.png", view_key: "focal_wide", mime_type: "image/png" }],
      versionMissesBeforeSuccess: 1,
      outcomesRecordedByOther: { anchor_detail: { outcome: "consistent", assetId: "va-detail-other" } }
    });
    const { deps: d, probe } = deps();
    // Not enough budget to outwait the live lease: this delivery owns only focal_wide.
    const result = await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + 100_000 + VIEW_START_RESERVE_MS - 1, now: d.now, deps: d });
    assert.equal(state.versionWrites.length, 2, "one miss, one retry");
    const retried = state.versionWrites[1].payload as { output_asset_ids: string[]; input_summary: { viewOutcomes: Record<string, unknown>; viewsComplete: boolean; viewsVersion: number } };
    assert.deepEqual(retried.output_asset_ids, ["asset-hero", "va-focal", "va-detail-other"], "the other delivery's view is kept");
    assert.deepEqual(Object.keys(retried.input_summary.viewOutcomes).sort(), ["anchor_detail", "focal_wide"]);
    assert.equal(retried.input_summary.viewsComplete, true);
    assert.equal(retried.input_summary.viewsVersion, 2);
    assert.equal(result.complete, true);
    assert.ok(state.versionWrites[1].filters.some(([column, value]) => column === "input_summary->>viewsVersion" && value === "1"));
  }

  // A close that fails once is retried, not read as a reclaim.
  {
    const { client, state } = scenario({ closeErrorsBeforeSuccess: 1 });
    const { deps: d, probe } = deps();
    const result = await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d });
    assert.equal(result.complete, true);
    assert.equal(state.checkRows.filter((row) => row.status === "succeeded").length, 2);
  }

  // (x) A generation that throws closes its row failed (freeing the key) and
  // the delivery's views job closes failed; an inconsistent view regenerates
  // once and, still inconsistent, is unresolved and left out of the list.
  {
    const { client, state } = scenario();
    const { deps: d, probe } = deps({ generateThrows: true });
    const result = await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d });
    assert.equal(result.complete, false);
    assert.ok(state.checkRows.every((row) => row.status === "failed"));
    const viewsJobClose = state.calls.find((call) => call.table === "ai_jobs" && call.op === "update" && (call.payload as { status?: string }).status === "failed" && !state.checkRows.some((row) => row.id === call.filters.find(([column]) => column === "id")?.[1]));
    assert.ok(viewsJobClose, "the delivery's views job closed failed");

    const twice = scenario();
    const { deps: d2, probe: p2 } = deps({ checksByKey: { focal_wide: [inconsistent(), inconsistent()], anchor_detail: [consistent()] } });
    const r2 = await ensureFinalRenderViews({ serviceSupabase: twice.client as never, renderJobId: "job-1", deadlineAt: p2.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d2.now, deps: d2 });
    assert.equal(r2.complete, true);
    const focalRow = twice.state.checkRows.find((row) => row.input_summary.viewKey === "focal_wide");
    assert.equal(focalRow?.status, "succeeded");
    assert.equal(focalRow?.output_summary?.outcome, "unresolved");
    assert.equal(p2.generations.filter((input) => input.viewKey === "focal_wide").length, 2);
    assert.match(p2.generations.filter((input) => input.viewKey === "focal_wide")[1].promptSuffix ?? "", /sofa changed colour/);
    const list = (twice.state.versionWrites.at(-1)!.payload as { output_asset_ids: string[] }).output_asset_ids;
    assert.equal(list.length, 2, "hero plus the detail view; the unresolved focal view is left out");
  }
}

// Review finding, the behaviour: a judge that says "consistent" while
// listing the composed focal label as missing is overruled by the code-side
// verdict, so the focal view is regenerated once and kept when the retry
// shows the focal wall.
async function focalMissingOverrulesTheJudge() {
  const { client, state } = scenario();
  const missingFocal = consistent({ expectedMissing: ["the TV and media wall (wall-mounted TV)"], expectedShown: ["low media console"] });
  const { deps: d, probe } = deps({ checksByKey: { focal_wide: [missingFocal, consistent()], anchor_detail: [consistent()] } });
  const result = await ensureFinalRenderViews({
    serviceSupabase: client as never,
    renderJobId: "job-1",
    deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS,
    now: d.now,
    deps: d
  });
  assert.equal(result.complete, true);
  assert.equal(probe.generations.filter((input) => input.viewKey === "focal_wide").length, 2, "the focal view is regenerated once");
  assert.equal(probe.generations.filter((input) => input.viewKey === "anchor_detail").length, 1);
  const focalClose = state.calls.find(
    (call) => call.table === "ai_jobs" && call.op === "update" && (call.payload as { output_summary?: { viewKey?: string; outcome?: string } }).output_summary?.viewKey === "focal_wide"
  );
  assert.equal((focalClose?.payload as { output_summary: { outcome: string } }).output_summary.outcome, "resolved_after_regeneration");
}

// Review findings on the audit trail and the scope of the phase's reads.
async function reviewFindings() {
  // A succeeded row of ANOTHER render job under the same key is never adopted:
  // the read is scoped to this job (tests review, contains filter).
  {
    const { client, state } = scenario({
      checkRows: [
        {
          id: "row-other-job",
          status: "succeeded",
          created_at: "2026-09-05T00:00:00Z",
          input_summary: { renderJobId: "job-2", viewKey: "focal_wide", leaseUntil: 0 },
          output_summary: { viewKey: "focal_wide", assetId: "asset-of-job-2", outcome: "consistent" }
        }
      ]
    });
    const { deps: d, probe } = deps();
    await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d });
    assert.ok(probe.generations.some((input) => input.viewKey === "focal_wide"), "the focal view is generated, not adopted from another job");
    assert.ok(!state.outputAssetIds.includes("asset-of-job-2"), "another job's asset never enters this job's list");
  }

  // A paid generation whose upload fails still closes its row with the spend
  // (Codex finding): the credits are counted the moment the provider answered.
  {
    const { client, state } = scenario({ uploadError: "bucket down" });
    const { deps: d, probe } = deps();
    await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d });
    const failedCloses = state.calls.filter(
      (call) => call.table === "ai_jobs" && call.op === "update" && (call.payload as { status?: string }).status === "failed" && typeof (call.payload as { output_summary?: { viewKey?: string } }).output_summary?.viewKey === "string"
    );
    assert.equal(failedCloses.length, 2, "both views failed at upload");
    for (const close of failedCloses) {
      const payload = close.payload as { cost_estimate_usd: number | null; output_summary: { imageCreditsUsed: number | null } };
      assert.ok(payload.output_summary.imageCreditsUsed !== null && payload.output_summary.imageCreditsUsed > 0, "the spend is on the failed row");
      assert.ok(payload.cost_estimate_usd !== null && payload.cost_estimate_usd > 0, "the failed row carries its cost");
    }
    assert.equal(probe.assessments.length, 0, "nothing was checked");
  }

  // Correctness review: a failed read or a failed list write is never read as
  // "nothing to do"; both throw so the queue redelivers and repairs.
  {
    const { client } = scenario({ jobReadError: "pooler blip" });
    const { deps: d, probe } = deps();
    await assert.rejects(
      ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d }),
      /pooler blip/
    );
    assert.equal(probe.generations.length, 0);
  }
  {
    const { client, state } = scenario({ listWriteError: "pooler blip" });
    const { deps: d, probe } = deps();
    await assert.rejects(
      ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + FINAL_RENDER_ATTEMPT_BUDGET_MS, now: d.now, deps: d }),
      /asset list could not be written/
    );
    assert.equal(state.versionWrites.length, 1, "a DB error is not retried as a version miss");
    assert.equal(state.checkRows.filter((row) => row.status === "succeeded").length, 2, "the views stand on their own rows for the redelivery");
  }

  // No time left after the generation means no paid check: the view is
  // recorded unchecked rather than checked against a floor timeout (Codex).
  {
    const { client, state } = scenario();
    const { deps: d, probe } = deps({ generateCostMs: VIEW_START_RESERVE_MS + 10_000 });
    await ensureFinalRenderViews({ serviceSupabase: client as never, renderJobId: "job-1", deadlineAt: probe.clock + VIEW_START_RESERVE_MS + 5_000, now: d.now, deps: d });
    assert.equal(probe.assessments.length, 0, "no check call was made with no time left");
    const closes = state.calls.filter(
      (call) => call.table === "ai_jobs" && call.op === "update" && (call.payload as { status?: string }).status === "succeeded" && typeof (call.payload as { output_summary?: { viewKey?: string } }).output_summary?.viewKey === "string"
    );
    assert.ok(closes.length >= 1 && closes.every((call) => (call.payload as { output_summary: { outcome: string } }).output_summary.outcome === "unchecked"));
  }
}

main()
  .then(focalMissingOverrulesTheJudge)
  .then(reviewFindings)
  .then(() => {
    console.log("render-views tests passed");
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
