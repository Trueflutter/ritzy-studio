import { selectAnchorSet, stageTextConfig, type AnchorSetResult } from "@ritzy-studio/ai";
import { configuredTextModel } from "@ritzy-studio/config";
import {
  anchorRolesFromBlueprint,
  anchorSeedFor,
  anchorSetFromShortlists,
  anchorShortlist,
  buildSpecSourcingPlan,
  productRolesForRoom,
  roleOptionKey,
  sourcingRolesFromBlueprint,
  type RankedProductMatch
} from "@ritzy-studio/domain";

import {
  anchorProviderTimeoutMs,
  anchorSetTimeoutMs,
  CONCEPT_RUN_BUDGET_MS
} from "@/lib/concept-run-budget";
import { fetchRemoteImage, visionImageDataUrl } from "@/lib/render-images";

import {
  PRODUCT_MATCHING_CATALOG_LIMIT,
  productToMatchCandidate,
  splitAvoidColorCues,
  type ProductRow
} from "./sourcing-support";
import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";

// Anchored concepts (S3b): the pieces that carry a room are chosen from live
// stock BEFORE the render, and the render is built from their photographs.
//
// S3 measured the other ordering and it does not work: with four retailers,
// roughly one in eight pieces an unconstrained render depicts has a genuine
// match in stock, so raising the bar turns wrong products into empty lists.
// Anchoring inverts that for the hero roles. Everything else is unchanged:
// sourcing fills the remaining roles against the confirmed spec afterwards.
//
// Two failures of the earlier product-first attempt are the reason this module
// is shaped the way it is, and both are acceptance criteria:
//
//   Pieces the room could not use. Every contract (category, class, room
//   scope, size against the room's measurements, seat range, object kind) is
//   applied by buildSpecSourcingPlan BEFORE anything is ranked, and the brief
//   is a hard filter on top of that, because an anchor sets the palette of the
//   render rather than sitting inside one.
//
//   The same pieces in every design. anchorShortlist drops what was anchored
//   recently, spreads across retailers and product families, and rotates by a
//   per-room, per-role seed. What the scorer alone cannot do is see the four
//   pieces TOGETHER, which is what the aesthetic set pass is for.

// Enough per role for the set pass to have a real choice, few enough that the
// photographs stay inside the run's image budget. The pass caps what it will
// look at as well; this is the fetch budget.
export const ANCHOR_CANDIDATES_PER_ROLE = 5;

// How far back "already used this piece" reaches for one owner. Large enough
// that a shopper doing a whole apartment does not meet the same sofa twice,
// small enough that a mature account is not eventually excluded from its own
// catalogue.
export const RECENT_ANCHOR_LOOKBACK = 60;

export type ConceptAnchor = {
  roleKey: string;
  roleCategory: string;
  roleLabel: string;
  product: RankedProductMatch;
  imageBytes: Buffer;
  imageMimeType: string;
  source: "aesthetic_pass" | "ranked_shortlist";
  reason: string | null;
};

// Why a room ended up with the anchors it has. Recorded on the generation job
// and reported to Ayo's criterion 10: a room whose anchor pass cannot run still
// gets a concept, from the ranked shortlist, and says so.
export type AnchorPassStatus =
  | "chosen"
  | "no_anchor_roles"
  | "no_candidates"
  | "no_images"
  | "skipped_no_budget"
  | "pass_failed";

export type ConceptAnchorOutcome = {
  anchors: ConceptAnchor[];
  status: AnchorPassStatus;
  error: string | null;
  setNote: string | null;
  costUsd: number | null;
  model: string | null;
  promptKey: string | null;
  promptVersion: string | null;
  jobId: string | null;
  roleCount: number;
  candidateCount: number;
};

function emptyOutcome(status: AnchorPassStatus, error: string | null = null): ConceptAnchorOutcome {
  return {
    anchors: [],
    status,
    error,
    setNote: null,
    costUsd: null,
    model: null,
    promptKey: null,
    promptVersion: null,
    jobId: null,
    roleCount: 0,
    candidateCount: 0
  };
}

// Products this owner has anchored a room on lately. Dropped from shortlists
// outright rather than demoted: with thousands of rows there is no reason to
// repeat, and repetition across a shopper's own rooms is exactly the complaint.
// Read through the user's client, so the row-level policy scopes it to rooms
// they own and no cross-owner read is possible even by mistake.
export async function recentAnchorProductIdsForUser(
  supabase: UserSupabaseClient,
  { excludeRoomId, limit = RECENT_ANCHOR_LOOKBACK }: { excludeRoomId: string; limit?: number }
): Promise<string[]> {
  const { data, error } = await supabase
    .from("concept_anchors")
    .select("product_id, room_id, created_at")
    .neq("room_id", excludeRoomId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) {
    return [];
  }

  return Array.from(new Set(data.map((row) => row.product_id).filter(Boolean)));
}

export type ChooseConceptAnchorsInput = {
  userId: string;
  roomId: string;
  roomType: string;
  roomPhotoDataUrl: string;
  budgetMaxAed: number | null;
  designBrief: {
    style_notes?: string | null;
    color_notes?: string | null;
    inspiration_notes?: string | null;
    functional_requirements?: string | null;
    avoid_notes?: string | null;
  };
  styleSlugs: string[];
  measurements: { wall_length_cm: number | null; room_depth_cm: number | null } | null;
  startedAt: number;
};

export type ChooseConceptAnchorsDeps = {
  selectSet?: typeof selectAnchorSet;
  fetchImage?: typeof fetchRemoteImage;
  now?: () => number;
  runBudgetMs?: number;
};

export async function chooseConceptAnchors(
  { supabase, serviceSupabase }: { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient },
  input: ChooseConceptAnchorsInput,
  deps: ChooseConceptAnchorsDeps = {}
): Promise<ConceptAnchorOutcome> {
  const selectSet = deps.selectSet ?? selectAnchorSet;
  const fetchImage = deps.fetchImage ?? fetchRemoteImage;
  const now = deps.now ?? Date.now;
  const runBudgetMs = deps.runBudgetMs ?? CONCEPT_RUN_BUDGET_MS;

  const anchorRoles = anchorRolesFromBlueprint(productRolesForRoom(input.roomType));
  if (anchorRoles.length === 0) {
    return emptyOutcome("no_anchor_roles");
  }

  const { data: products = [] } = await serviceSupabase
    .from("products")
    .select(
      `
      *,
      retailer:retailers(name, status),
      dimensions:product_dimensions(width_cm, depth_cm, height_cm, source_text)
    `
    )
    .not("price_aed", "is", null)
    .not("primary_image_url", "is", null)
    .order("last_checked_at", { ascending: false, nullsFirst: false })
    .limit(PRODUCT_MATCHING_CATALOG_LIMIT);

  const candidates = ((products ?? []) as ProductRow[])
    .map(productToMatchCandidate)
    .filter((candidate): candidate is NonNullable<typeof candidate> => Boolean(candidate));

  if (candidates.length === 0) {
    return emptyOutcome("no_candidates");
  }

  const avoidColorTags = splitAvoidColorCues(input.designBrief.avoid_notes ?? "").avoidColorTags;
  const recentAnchorProductIds = await recentAnchorProductIdsForUser(supabase, { excludeRoomId: input.roomId });

  const plan = buildSpecSourcingPlan({
    roles: sourcingRolesFromBlueprint(anchorRoles, input.roomType),
    unsourceable: [],
    candidates,
    roomType: input.roomType,
    conceptText: [
      input.designBrief.style_notes,
      input.designBrief.color_notes,
      input.designBrief.inspiration_notes
    ]
      .filter(Boolean)
      .join("\n"),
    budgetMaxAed: input.budgetMaxAed,
    roomMeasurements: input.measurements
      ? { wallLengthCm: input.measurements.wall_length_cm, roomDepthCm: input.measurements.room_depth_cm }
      : null,
    avoidColorTags,
    candidatesPerRole: ANCHOR_CANDIDATES_PER_ROLE * 2
  });

  const shortlists = plan.pools
    .map((pool) => ({
      role: pool.role,
      candidates: anchorShortlist({
        candidates: pool.candidates,
        avoidColorTags,
        recentAnchorProductIds,
        seed: anchorSeedFor(input.roomId, pool.role.category),
        size: ANCHOR_CANDIDATES_PER_ROLE
      })
    }))
    .filter((shortlist) => shortlist.candidates.length > 0);

  if (shortlists.length === 0) {
    return emptyOutcome("no_candidates");
  }

  // An anchor must have a photograph. The set pass needs one to judge it and
  // the render needs one to build from, so the fetch happens once, here, and a
  // product whose image cannot be fetched is not eligible to anchor anything.
  // This is also what keeps a retailer's URL out of the image provider: an
  // anchor reaches the render as bytes, never as a link for it to follow.
  const imagesByProductId = new Map<string, { bytes: Buffer; mimeType: string; dataUrl: string }>();
  await Promise.all(
    shortlists.flatMap((shortlist) =>
      shortlist.candidates.map(async (candidate) => {
        if (!candidate.primaryImageUrl) {
          return;
        }
        const image = await fetchImage(candidate.primaryImageUrl);
        if (!image) {
          return;
        }
        imagesByProductId.set(candidate.id, {
          bytes: image.bytes,
          mimeType: image.mimeType,
          dataUrl: await visionImageDataUrl(image.bytes, image.mimeType)
        });
      })
    )
  );

  const withImages = shortlists
    .map((shortlist) => ({
      role: shortlist.role,
      candidates: shortlist.candidates.filter((candidate) => imagesByProductId.has(candidate.id))
    }))
    .filter((shortlist) => shortlist.candidates.length > 0);

  if (withImages.length === 0) {
    return emptyOutcome("no_images");
  }

  const anchorFor = (
    role: { category: string; label: string; roleKey?: string },
    product: RankedProductMatch,
    source: ConceptAnchor["source"],
    reason: string | null
  ): ConceptAnchor => {
    const image = imagesByProductId.get(product.id)!;
    return {
      roleKey: roleOptionKey(role),
      roleCategory: role.category,
      roleLabel: role.label,
      product,
      imageBytes: image.bytes,
      imageMimeType: image.mimeType,
      source,
      reason
    };
  };

  // The set used whenever the pass does not decide: the head of each shortlist,
  // with one retailer never allowed to furnish the whole room.
  const rankedFallback = () =>
    anchorSetFromShortlists(withImages).map((pick) =>
      anchorFor(pick.role, pick.product, "ranked_shortlist", pick.product.selectionReason ?? null)
    );

  const roleCount = withImages.length;
  const candidateCount = withImages.reduce((total, shortlist) => total + shortlist.candidates.length, 0);
  const guardMs = anchorSetTimeoutMs({ startedAt: input.startedAt, now: now(), runBudgetMs });

  if (guardMs === null) {
    return {
      ...emptyOutcome("skipped_no_budget"),
      anchors: rankedFallback(),
      roleCount,
      candidateCount
    };
  }

  // Opened before the paid call, so a run that dies mid-call still leaves a
  // row that says a call was made.
  const { data: job } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: input.userId,
      room_id: input.roomId,
      job_type: "anchor_set_selection",
      status: "running",
      provider: "openai",
      model: stageTextConfig("anchor_set", configuredTextModel()).model,
      input_summary: { roomId: input.roomId, roleCount, candidateCount }
    })
    .select("id")
    .single();

  const closeJob = async (fields: Record<string, unknown>) => {
    if (!job) {
      return;
    }
    await serviceSupabase
      .from("ai_jobs")
      .update({ completed_at: new Date().toISOString(), ...fields })
      .eq("id", job.id);
  };

  let result: AnchorSetResult;
  try {
    result = await selectSet({
      roomPhotoUrl: input.roomPhotoDataUrl,
      brief: {
        roomType: input.roomType,
        styleSlugs: input.styleSlugs,
        styleNotes: input.designBrief.style_notes,
        colorNotes: input.designBrief.color_notes,
        inspirationNotes: input.designBrief.inspiration_notes,
        functionalRequirements: input.designBrief.functional_requirements,
        avoidNotes: input.designBrief.avoid_notes
      },
      roles: withImages.map((shortlist) => ({
        roleKey: roleOptionKey(shortlist.role),
        roleLabel: shortlist.role.label,
        category: shortlist.role.category,
        candidates: shortlist.candidates.map((candidate) => ({
          productId: candidate.id,
          name: candidate.name,
          retailerName: candidate.retailerName ?? null,
          color: candidate.color ?? null,
          material: candidate.material ?? null,
          priceAed: candidate.priceAed ?? null,
          imageDataUrl: imagesByProductId.get(candidate.id)!.dataUrl
        }))
      })),
      timeoutMs: anchorProviderTimeoutMs(guardMs)
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The anchor set pass failed.";
    // A room still gets a concept: the ranked shortlist decides, and the job
    // says the pass is why. Criterion 10.
    await closeJob({ status: "failed", error_message: message });
    return {
      ...emptyOutcome("pass_failed", message),
      anchors: rankedFallback(),
      jobId: job?.id ?? null,
      roleCount,
      candidateCount
    };
  }

  const shortlistByRoleKey = new Map(withImages.map((shortlist) => [roleOptionKey(shortlist.role), shortlist]));
  const anchors = result.picks.flatMap((pick) => {
    const shortlist = shortlistByRoleKey.get(pick.roleKey);
    const product = shortlist?.candidates.find((candidate) => candidate.id === pick.productId);
    // A role the pass left out stays out. It judged nothing in that shortlist
    // fit the set, and filling it with the shortlist head would put the piece
    // it rejected into the render and make it the room. Sourcing fills the role
    // afterwards, on the list, where a shopper can see the options and choose.
    return shortlist && product ? [anchorFor(shortlist.role, product, "aesthetic_pass", pick.reason)] : [];
  });

  await closeJob({
    // A call whose answers were all thrown away is not a success, whatever the
    // provider said. Without this, a protocol regression that silently emptied
    // every set would be indistinguishable in telemetry from a stylist that
    // liked nothing, and the money would keep being spent either way.
    status: result.dropped.length > 0 && anchors.length === 0 ? "failed" : "succeeded",
    model: result.model,
    prompt_version: result.promptVersion,
    cost_estimate_usd: result.textCostUsd,
    error_message:
      result.dropped.length > 0 && anchors.length === 0
        ? `The anchor set pass answered for ${result.dropped.length} role(s), none usable.`
        : null,
    output_summary: {
      promptKey: result.promptKey,
      setNote: result.setNote,
      chosen: anchors.map((anchor) => ({ roleKey: anchor.roleKey, productId: anchor.product.id })),
      dropped: result.dropped,
      rolesOffered: roleCount,
      rolesFilled: anchors.length
    }
  });

  return {
    anchors,
    status: "chosen",
    error:
      result.dropped.length > 0
        ? `The anchor set pass named ${result.dropped.length} product(s) the room could not use.`
        : null,
    // Not offered as the room's rationale when answers were discarded: it
    // describes a scheme that includes pieces no one anchored.
    setNote: result.dropped.length > 0 ? null : result.setNote,
    costUsd: result.textCostUsd,
    model: result.model,
    promptKey: result.promptKey,
    promptVersion: result.promptVersion,
    jobId: job?.id ?? null,
    roleCount,
    candidateCount
  };
}

// The rows that record what a render was actually built from. Written after the
// concept row exists, because until then there is nothing for them to belong to.
export async function persistConceptAnchors(
  supabase: UserSupabaseClient,
  {
    roomId,
    conceptId,
    anchors,
    selectionJobId
  }: { roomId: string; conceptId: string; anchors: ConceptAnchor[]; selectionJobId: string | null }
) {
  if (anchors.length === 0) {
    return;
  }
  await supabase.from("concept_anchors").upsert(
    anchors.map((anchor) => ({
      room_id: roomId,
      concept_id: conceptId,
      role_key: anchor.roleKey,
      role_category: anchor.roleCategory,
      role_label: anchor.roleLabel,
      product_id: anchor.product.id,
      source: anchor.source,
      reason: anchor.reason,
      selection_job_id: selectionJobId
    })),
    { onConflict: "concept_id,role_key" }
  );
}
