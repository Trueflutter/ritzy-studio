import { selectAnchorSet, stageTextConfig, type AnchorSetResult } from "@ritzy-studio/ai";
import { configuredTextModel } from "@ritzy-studio/config";
import {
  anchorRolesFromBlueprint,
  anchorSeedFor,
  anchorSetFromShortlists,
  anchorShortlist,
  buildSpecSourcingPlan,
  enhancedProductRolesForRoom,
  roleOptionKey,
  sourcingRolesFromBlueprint,
  wantedColorFamilies,
  type ProductMatchCandidate,
  type RankedProductMatch
} from "@ritzy-studio/domain";

import {
  anchorPrepTimeoutMs,
  anchorProviderTimeoutMs,
  anchorSetTimeoutMs,
  CONCEPT_RUN_BUDGET_MS
} from "@/lib/concept-run-budget";
import { fetchRemoteImage, visionImageDataUrl } from "@/lib/render-images";
import { withTimeout } from "@/lib/with-timeout";

import { closeAiJob } from "./close-ai-job";

import { loadCatalogueCandidates, splitAvoidColorCues } from "./sourcing-support";
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

// How deep the anchor pool is built before the shortlist is drawn from it.
// Deeper than the shortlist on purpose: the pool is ranked, and a brief's
// colour competes there with freshness and tag overlap, so the piece that
// actually carries the brief can sit at rank 19 of a category. The shortlist
// then promotes it to the front. Pure ranking over an in-memory list; no paid
// call is bounded by this.
const ANCHOR_POOL_DEPTH = 30;

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
  // The catalogue read or the photograph fetches ran past what the run could
  // spare. The render still happens, unanchored: an anchor pass that overran
  // must never be the reason the request is killed before the render.
  | "prep_timed_out"
  | "skipped_no_budget"
  // The pass's own ai_jobs row could not be opened, so the call was never made.
  | "skipped_no_audit_row"
  | "pass_failed";

// Only what the caller records on the generation job. The pass's own model,
// prompt version and shortlist sizes live on the pass's own ai_jobs row, which
// is where a per-call view belongs; carrying them here as well would make every
// early return restate values nothing reads.
export type ConceptAnchorOutcome = {
  anchors: ConceptAnchor[];
  status: AnchorPassStatus;
  error: string | null;
  setNote: string | null;
  costUsd: number | null;
  jobId: string | null;
};

function emptyOutcome(status: AnchorPassStatus, error: string | null = null): ConceptAnchorOutcome {
  return { anchors: [], status, error, setNote: null, costUsd: null, jobId: null };
}

// Products this owner has anchored a room on lately. Dropped from shortlists
// outright rather than demoted: with thousands of rows there is no reason to
// repeat, and repetition across a shopper's own rooms is exactly the complaint.
// Read through the user's client, so the row-level policy scopes it to rooms
// they own and no cross-owner read is possible even by mistake.
export async function recentAnchorProductIdsForUser(
  supabase: UserSupabaseClient,
  { userId, excludeRoomId, limit = RECENT_ANCHOR_LOOKBACK }: { userId: string; excludeRoomId: string; limit?: number }
): Promise<string[]> {
  const { data, error } = await supabase
    .from("concept_anchors")
    .select("product_id, room_id, created_at, room:rooms!inner(project:projects!inner(owner_user_id))")
    // Scoped by the owner explicitly, not only by the row policy. Both client
    // types alias the same type, so "pass the user's client" is a convention a
    // refactor can break silently, and the failure is a cross-tenant read that
    // narrows this shopper's shortlist by strangers' rooms. The sibling recency
    // reader in this layer filters the same way.
    .eq("room.project.owner_user_id", userId)
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
  loadCatalogue?: typeof loadCatalogueCandidates;
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
  const loadCatalogue = deps.loadCatalogue ?? loadCatalogueCandidates;
  const now = deps.now ?? Date.now;
  const runBudgetMs = deps.runBudgetMs ?? CONCEPT_RUN_BUDGET_MS;

  // The ROOM-AWARE blueprint, the one sourcing itself uses. The legacy
  // productRolesForRoom has no office entry and falls through to a generic
  // default, so a Home Office was anchored on a sofa, an armchair, a rug and a
  // coffee table, and the render was then BUILT around them. That is Ayo's
  // first warning with the render constructed on top of it, and the contracts
  // do not catch it: room scope only constrains decor-ish categories, and an
  // office-scoped role deliberately relaxes the desk and task-chair exclusions.
  const anchorRoles = anchorRolesFromBlueprint(enhancedProductRolesForRoom(input.roomType));
  if (anchorRoles.length === 0) {
    return emptyOutcome("no_anchor_roles");
  }

  // The anchor stage's own clock. Everything the request did before reaching
  // here is the render's headroom to give, not this stage's allowance to lose.
  const stageStartedAt = now();
  const prepMs = anchorPrepTimeoutMs({ startedAt: input.startedAt, stageStartedAt, now: now(), runBudgetMs });
  if (prepMs === null) {
    return emptyOutcome("prep_timed_out", "The request had no time left to choose anchors before the render.");
  }
  const prepDeadline = now() + prepMs;

  let candidates: ProductMatchCandidate[];
  try {
    ({ candidates } = await withTimeout(
      loadCatalogue(serviceSupabase),
      prepMs,
      "The catalogue read ran past the time the run could spare for anchors."
    ));
  } catch (error) {
    return emptyOutcome("prep_timed_out", error instanceof Error ? error.message : "The catalogue read timed out.");
  }

  if (candidates.length === 0) {
    return emptyOutcome("no_candidates");
  }

  const avoidColorTags = splitAvoidColorCues(input.designBrief.avoid_notes ?? "").avoidColorTags;
  // What the brief ASKS for, read from its own words. The contracts already
  // enforce what it forbids; this is the half that was missing, and without it
  // a room briefed for a committed colour was anchored on whatever the rotation
  // landed on and the render faithfully built a room around that.
  const wanted = wantedColorFamilies(
    input.designBrief.color_notes,
    input.designBrief.style_notes,
    input.designBrief.inspiration_notes
  );
  // Bounded like the catalogue read either side of it, and for the same
  // reason: a degraded pooler hangs rather than failing, and an unbounded hang
  // here runs the concept request past the route limit. Losing the recency
  // window costs some variety; losing the request costs the concept.
  const recentAnchorProductIds = await withTimeout(
    recentAnchorProductIdsForUser(supabase, { userId: input.userId, excludeRoomId: input.roomId }),
    Math.max(1_000, prepDeadline - now()),
    "The recency read ran past the time the run could spare for anchors."
  ).catch((error) => {
    console.error("Anchor recency read timed out; this room may repeat a recent piece.", error);
    return [] as string[];
  });

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
    candidatesPerRole: ANCHOR_POOL_DEPTH
  });

  // No per-role price cap on the anchors. An earlier version gave each role a
  // weighted share of the room and refused anything above it, which priced a
  // 20,000 AED room's sofa at about 4,300 and put most of the catalogue out of
  // reach of anchoring anything. Ayo's direction, 2026-09-03: "I would never
  // want to sacrifice quality for that."
  //
  // The room's figure still reaches these pools through buildSpecSourcingPlan's
  // own gates, which compare a piece against the WHOLE room rather than a
  // slice of it, so a 50,000 sofa still cannot anchor a 20,000 room. What is
  // gone is the slice.
  const shortlists = plan.pools
    .map((pool) => ({
      role: pool.role,
      candidates: anchorShortlist({
        candidates: pool.candidates,
        avoidColorTags,
        wantedColorFamilies: wanted,
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
  const fetches = Promise.all(
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
  try {
    // What is left of the prep window after the catalogue read, so the read and
    // the fetches share one budget rather than each getting a fresh one.
    await withTimeout(
      fetches,
      Math.max(1_000, prepDeadline - now()),
      "The candidate photograph fetches ran past the time the run could spare for anchors."
    );
  } catch (error) {
    // Whatever arrived before the deadline still counts: the map is filled as
    // each fetch lands, so a set can be chosen from what is there. Only a run
    // that got nothing gives up.
    console.error("Anchor candidate image fetch timed out; choosing from what arrived.", error);
    if (imagesByProductId.size === 0) {
      return emptyOutcome("prep_timed_out", error instanceof Error ? error.message : "The photograph fetches timed out.");
    }
  }

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
  const guardMs = anchorSetTimeoutMs({ startedAt: input.startedAt, stageStartedAt, now: now(), runBudgetMs });

  if (guardMs === null) {
    return { ...emptyOutcome("skipped_no_budget"), anchors: rankedFallback() };
  }

  // Opened before the paid call, so a run that dies mid-call still leaves a
  // row that says a call was made. If it cannot be opened the call is not made
  // at all: the concept job deliberately excludes this cost from its own total
  // ("a run's spend is the sum of its rows"), so a call with no row of its own
  // is spend that no per-room aggregation can ever see. Sourcing refuses on the
  // same grounds.
  const { data: job, error: jobError } = await serviceSupabase
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

  if (jobError || !job) {
    console.error(
      `Room ${input.roomId}: the anchor pass has no audit row (${jobError?.message ?? "no row returned"}); the ranked shortlist decides instead.`
    );
    return {
      ...emptyOutcome("skipped_no_audit_row", jobError?.message ?? "The anchor pass could not open an audit row."),
      anchors: rankedFallback()
    };
  }

  const closeJob = async (fields: Record<string, unknown>) => {
    await closeAiJob(serviceSupabase, job.id, { completed_at: new Date().toISOString(), ...fields }, "anchor set pass");
  };

  let result: AnchorSetResult;
  try {
    // The provider's own deadline is the inner bound; this guard is the
    // backstop, for the class of hang an SDK abort does not tear down. The
    // sibling paid call in sourcing is wrapped the same way, and the headroom
    // constant exists so the two cannot fire at the same moment.
    result = await withTimeout(
      selectSet({
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
      }),
      guardMs,
      "The anchor set pass ran past the time the run could spare for it."
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "The anchor set pass failed.";
    // A room still gets a concept: the ranked shortlist decides, and the job
    // says the pass is why. Criterion 10.
    await closeJob({ status: "failed", error_message: message });
    return { ...emptyOutcome("pass_failed", message), anchors: rankedFallback(), jobId: job.id };
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

  // Every answer discarded is the pass having no effect, which the job row is
  // already told to record as a failure. The return has to agree with it, or
  // the concept job's own summary reports "chosen" with nothing chosen and the
  // room goes unanchored past a usable ranked shortlist.
  if (anchors.length === 0 && result.dropped.length > 0) {
    return {
      ...emptyOutcome(
        "pass_failed",
        `The anchor set pass named ${result.dropped.length} product(s) the room could not use, and nothing it could.`
      ),
      anchors: rankedFallback(),
      jobId: job.id
    };
  }

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
    jobId: job.id
  };
}

// The verdict on whether the render kept an anchor, written where only the
// server can write it. The list's is_anchor column and a row's selected status
// both sit on a table the list's owner may PATCH, so neither can carry a claim
// the app makes on the shopper's behalf, and neither can be what the design
// gate reads. This can, and is.
export async function recordAnchorVerification(
  serviceSupabase: ServiceSupabaseClient,
  {
    conceptId,
    verdicts
  }: {
    conceptId: string;
    // EVERY anchor this run judged, not only the ones it confirmed. A null
    // similarity is a verdict too: the check looked and did not stand behind
    // the piece. Writing only the passes let a later run leave an earlier
    // run's "verified" in place after this one declined the same anchor, and
    // this record is the authority the design gate and any badge read.
    verdicts: ReadonlyArray<{ productId: string; similarity: number | null }>;
  }
) {
  if (verdicts.length === 0) {
    return;
  }
  const verifiedAt = new Date().toISOString();
  await Promise.all(
    verdicts.map(async (entry) => {
      const { error } = await serviceSupabase
        .from("concept_anchors")
        .update({
          verified_similarity: entry.similarity,
          verified_at: entry.similarity === null ? null : verifiedAt
        })
        .eq("concept_id", conceptId)
        .eq("product_id", entry.productId);
      if (error) {
        console.error(
          `Concept ${conceptId}: could not record the design check's verdict for anchor ${entry.productId} (${error.message}).`
        );
      }
    })
  );
}

// The rows that record what a render was actually built from. Written after the
// concept row exists, because until then there is nothing for them to belong to.
export async function persistConceptAnchors(
  // The SERVICE client, deliberately. These rows are the record of what the
  // server built a render from, and the table's policy now lets an owner read
  // them and nobody but the server write them: a client-authored anchor would
  // skip the visual pass, skip the spec role's size and capacity contracts, be
  // judged at the anchor bar, and put "this piece is in your design" on a list
  // for a piece no render was built around.
  serviceSupabase: ServiceSupabaseClient,
  {
    roomId,
    conceptId,
    anchors,
    selectionJobId
  }: { roomId: string; conceptId: string; anchors: ConceptAnchor[]; selectionJobId: string | null }
): Promise<{ persisted: boolean }> {
  if (anchors.length === 0) {
    return { persisted: true };
  }
  const rows = anchors.map((anchor) => ({
    room_id: roomId,
    concept_id: conceptId,
    role_key: anchor.roleKey,
    role_category: anchor.roleCategory,
    role_label: anchor.roleLabel,
    product_id: anchor.product.id,
    source: anchor.source,
    reason: anchor.reason,
    selection_job_id: selectionJobId
  }));

  // Retried once, then logged loudly, and never thrown. Without these rows
  // sourcing re-decides the anchored roles and can put a different sofa on the
  // list than the one in the render, which is the mismatch this slice exists to
  // remove; but the render is already paid for and the shopper can see it, so
  // failing the whole generation over a provenance write would be the worse
  // trade. The loss has to be visible either way.
  const write = async () =>
    (await serviceSupabase.from("concept_anchors").upsert(rows, { onConflict: "room_id,concept_id,role_key" })).error;
  const error = (await write()) ? await write() : null;
  if (error) {
    console.error(
      `Concept ${conceptId}: the render's anchors could not be recorded (${error.message}); sourcing will re-decide those roles.`
    );
  }
  return { persisted: !error };
}

// ------------------------------------------------- what sourcing must not redo

export type ConceptAnchorRow = {
  role_key: string;
  role_category: string;
  role_label: string;
  product_id: string;
  source: string;
  reason: string | null;
};

export async function readConceptAnchors(
  supabase: UserSupabaseClient,
  { roomId, conceptId }: { roomId: string; conceptId: string }
): Promise<ConceptAnchorRow[]> {
  const { data, error } = await supabase
    .from("concept_anchors")
    .select("role_key, role_category, role_label, product_id, source, reason")
    .eq("room_id", roomId)
    .eq("concept_id", conceptId)
    .order("created_at", { ascending: true });

  return error || !data ? [] : data;
}

export type AnchoredSpecRole<P> = {
  pool: P;
  productId: string;
  reason: string | null;
};

// The roles this render was BUILT from. The piece is in the picture because the
// picture was made from its photograph, so there is nothing here for the
// sourcing pass to propose or for the design check to judge: asking the judge
// whether the render contains what the render was built from spends budget to
// re-derive a fact, and pays for the judge's variance on top.
//
// An anchor claims the first unclaimed spec role in its own category. One room
// can carry two roles in a category (a living-dining hall has two seating
// objects); the anchor takes one of them and the other is sourced normally.
//
// A pool that does not contain the anchor is NOT claimed. The spec was
// extracted from a render built around the piece, so the contracts should admit
// it and the caller looks deeper before giving up; if it is genuinely rejected
// for this role, the role goes to normal sourcing rather than having the anchor
// forced into it with a score nobody computed.
// The piece the render was built from leads its role's options. It matters on
// the path where the judge FAILS the anchor and the role opens: the shopper is
// then choosing for a role whose render they approved, and the piece in that
// picture belongs at the top rather than at whatever rank the scorer gave it.
function withAnchorFirst<P extends { candidates: ReadonlyArray<{ id: string }> }>(pool: P, productId: string): P {
  const anchor = pool.candidates.find((candidate) => candidate.id === productId);
  return anchor
    ? { ...pool, candidates: [anchor, ...pool.candidates.filter((candidate) => candidate.id !== productId)] }
    : pool;
}

export function claimAnchoredPools<P extends { role: { category: string }; candidates: ReadonlyArray<{ id: string }> }>({
  pools,
  anchors,
  deepen
}: {
  pools: P[];
  anchors: ReadonlyArray<{ role_category: string; product_id: string; reason: string | null }>;
  // Rebuilds one role's pool deep enough to reach a product below the cut the
  // sourcing pass is sized for. Same contracts, same scorer.
  deepen?: (pool: P, productId: string) => P | null;
}): { anchored: Array<AnchoredSpecRole<P>>; remaining: P[]; unclaimed: string[] } {
  const claimed = new Set<P>();
  const anchored: Array<AnchoredSpecRole<P>> = [];
  const unclaimed: string[] = [];

  for (const anchor of anchors) {
    const match = pools.find(
      (pool) => !claimed.has(pool) && pool.role.category === anchor.role_category
    );
    if (!match) {
      unclaimed.push(anchor.product_id);
      continue;
    }
    const pool = match.candidates.some((candidate) => candidate.id === anchor.product_id)
      ? match
      : (deepen?.(match, anchor.product_id) ?? null);
    if (!pool || !pool.candidates.some((candidate) => candidate.id === anchor.product_id)) {
      unclaimed.push(anchor.product_id);
      continue;
    }
    claimed.add(match);
    anchored.push({ pool: withAnchorFirst(pool, anchor.product_id), productId: anchor.product_id, reason: anchor.reason });
  }

  return { anchored, remaining: pools.filter((pool) => !claimed.has(pool)), unclaimed };
}
