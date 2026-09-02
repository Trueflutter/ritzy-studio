import { extractRoomDesignSpec, stageTextConfig } from "@ritzy-studio/ai";
import { configuredTextModel } from "@ritzy-studio/config";
import type { Database } from "@ritzy-studio/db";
import {
  designSpecMustPreserveSchema,
  designSpecObjectsSchema,
  parseRoomDesignSpecRow,
  type RoomDesignSpec
} from "@ritzy-studio/domain";

import { isSpecExtractionStalled, specExtractionLeaseMs } from "@/lib/spec-extraction";

import { conceptPrimaryRender, signedConceptRenderUrl } from "./room-images";
import type { ServiceSupabaseClient, UserSupabaseClient } from "./supabase-clients";

// The design-spec service (S2 step 8): spec-at-approval with on-demand backfill.
//
// Lifecycle (PR #332 review fix). The paid vision call never runs inside a
// request a user is waiting on:
//   - READERS (`readRoomDesignSpec`: the /spec page, sourcing) only read
//     persisted state. A `running` ai_jobs row is a LEASE bounded by the
//     provider deadline (lib/spec-extraction); past it the run is provably dead
//     and the reader reclaims the row with a compare-and-swap instead of
//     reporting "already running".
//   - STARTERS (`ensureRoomDesignSpec` on the screen's first touch,
//     `startRoomDesignSpecExtraction` from approval and Retry) open the lease
//     row and hand ONLY the job id to the detached runner through the injected
//     `defer` (after() in production, so a closed tab cannot abort it).
//   - The RUNNER (`runRoomDesignSpecExtraction`) re-derives everything from the
//     job row and finalizes ONLY while it still owns the lease: every terminal
//     write is a status-conditional compare-and-swap, ownership is re-verified
//     before anything is persisted, and a run whose lease was reclaimed
//     discards its result and records only its spend, never touching the
//     terminal status the reclaim set. Cost is recorded on every exit, even
//     when the spec write fails after a paid call.
// A paid extraction therefore can never sit in `running` past its lease, the
// user is never locked out behind a dead job, and a GET starts at most ONE
// attempt per concept: after any recorded attempt only an explicit Retry
// (POST) spends again. confirmRoomDesignSpec persists the user's edits and
// flips the row to confirmed truth.

type Clients = { supabase: UserSupabaseClient; serviceSupabase: ServiceSupabaseClient };

export const SPEC_EXTRACTION_JOB_TYPE = "spec_extraction";

export type RoomDesignSpecState =
  | { status: "no_selected_concept" }
  | { status: "concept_image_unprepared" }
  | { status: "extraction_needed"; conceptId: string }
  | { status: "extraction_running"; jobId: string; startedAt: string; staleAt: string }
  | { status: "extraction_failed"; conceptId: string; retryable: boolean }
  | {
      status: "ready";
      spec: RoomDesignSpec;
      conceptTitle: string;
      renderSignedUrl: string | null;
    };

type ReadOptions = { now?: number; leaseMs?: number };

export async function readRoomDesignSpec(
  clients: Clients,
  { roomId }: { roomId: string },
  options: ReadOptions = {}
): Promise<RoomDesignSpecState> {
  return readState(clients, roomId, options, false);
}

async function readState(
  { supabase, serviceSupabase }: Clients,
  roomId: string,
  { now = Date.now(), leaseMs = specExtractionLeaseMs() }: ReadOptions,
  afterReclaimMiss: boolean
): Promise<RoomDesignSpecState> {
  const { data: room } = await supabase
    .from("rooms")
    .select("id, room_type")
    .eq("id", roomId)
    .single();

  const { data: concept } = await supabase
    .from("concepts")
    .select("id, title, status, primary_image_asset_id")
    .eq("room_id", roomId)
    .eq("status", "selected")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!room || !concept) {
    return { status: "no_selected_concept" };
  }

  // The two reads below gate spending. A failed read is surfaced, never
  // mistaken for "nothing on record": that is the one state in which a page
  // load may open a lease, and a pooler blip must not buy a second run.
  const { data: existing, error: existingError } = await supabase
    .from("room_design_specs")
    .select("*")
    .eq("room_id", roomId)
    .eq("concept_id", concept.id)
    .maybeSingle();
  if (existingError) {
    throw new Error(existingError.message);
  }

  if (existing) {
    const parsed = parseRoomDesignSpecRow(existing);
    if (parsed) {
      return {
        status: "ready",
        spec: parsed,
        conceptTitle: concept.title,
        renderSignedUrl: await signedConceptRenderUrl({ supabase, serviceSupabase }, concept.primary_image_asset_id)
      };
    }
    // A malformed CONFIRMED row (only reachable by direct PostgREST writes to
    // one's own row) is never worth a paid call: the runner's guarded repair
    // never touches confirmed rows, so extracting would fail every time.
    // Surface the honest failed state at zero spend, with Retry withheld; the
    // RPC-only write consolidation lands with S7's money-table hardening. A
    // malformed EXTRACTED row falls through: a Retry's runner repairs it.
    if (existing.status === "confirmed") {
      return { status: "extraction_failed", conceptId: concept.id, retryable: false };
    }
  }

  if (!concept.primary_image_asset_id) {
    return { status: "concept_image_unprepared" };
  }

  const { data: latestJob, error: latestJobError } = await serviceSupabase
    .from("ai_jobs")
    .select("id, status, created_at")
    .eq("room_id", roomId)
    .eq("job_type", SPEC_EXTRACTION_JOB_TYPE)
    .contains("input_summary", { conceptId: concept.id })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (latestJobError) {
    throw new Error(latestJobError.message);
  }

  if (!latestJob) {
    return { status: "extraction_needed", conceptId: concept.id };
  }

  if (latestJob.status === "running" || latestJob.status === "queued") {
    if (!isSpecExtractionStalled(latestJob.status, latestJob.created_at, now, leaseMs)) {
      return {
        status: "extraction_running",
        jobId: latestJob.id,
        startedAt: latestJob.created_at,
        staleAt: new Date(Date.parse(latestJob.created_at) + leaseMs).toISOString()
      };
    }
    if (afterReclaimMiss) {
      // Unreachable in practice (a job only moves to a terminal status), kept so
      // the recursion below is provably bounded.
      return {
        status: "extraction_running",
        jobId: latestJob.id,
        startedAt: latestJob.created_at,
        staleAt: new Date(now).toISOString()
      };
    }
    // Reclaim the expired lease. Compare-and-swap on the status so a run that
    // reported in between our read and this write is never flipped back to
    // failed; a DB error is surfaced, never read as "another process won".
    const { data: reclaimed, error: reclaimError } = await serviceSupabase
      .from("ai_jobs")
      .update({
        status: "failed",
        completed_at: new Date(now).toISOString(),
        error_message: `Spec extraction reported no result within its ${Math.round(
          leaseMs / 1000
        )}s lease; the run was abandoned.`
      })
      .eq("id", latestJob.id)
      .in("status", ["running", "queued"])
      .select("id");
    if (reclaimError) {
      throw new Error(reclaimError.message);
    }
    if ((reclaimed ?? []).length > 0) {
      return { status: "extraction_failed", conceptId: concept.id, retryable: true };
    }
    // CAS miss: the run reported in after our read. Read the outcome it left.
    return readState({ supabase, serviceSupabase }, roomId, { now, leaseMs }, true);
  }

  // A recorded attempt that left no readable spec (failed, cancelled, or a
  // succeeded run whose row was since lost or mangled): only an explicit Retry
  // spends again.
  return { status: "extraction_failed", conceptId: concept.id, retryable: true };
}

export type SpecExtractionDefer = (task: () => Promise<void>) => void;

type StartOptions = ReadOptions & {
  // Required: the caller decides how the paid run outlives its request
  // (after() in production, a recorder in tests).
  defer: SpecExtractionDefer;
  // Injectable so the scheduling contract is testable without a live provider.
  run?: (input: { jobId: string }) => Promise<void>;
};

// Opens the lease row and schedules the detached runner. Spend never precedes
// its audit row: a failed insert schedules nothing.
async function beginExtraction(
  { serviceSupabase }: Clients,
  { userId, roomId, conceptId }: { userId: string; roomId: string; conceptId: string },
  { defer, run }: { defer: SpecExtractionDefer; run: (input: { jobId: string }) => Promise<void> }
): Promise<{ jobId: string } | null> {
  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .insert({
      user_id: userId,
      room_id: roomId,
      job_type: SPEC_EXTRACTION_JOB_TYPE,
      status: "running",
      provider: "openai",
      model: stageTextConfig("spec_extraction", configuredTextModel()).model,
      input_summary: { roomId, conceptId }
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return null;
  }

  defer(() => run({ jobId: job.id }));
  return { jobId: job.id };
}

function defaultRunner(clients: Clients) {
  return ({ jobId }: { jobId: string }) => runRoomDesignSpecExtraction(clients.serviceSupabase, { jobId });
}

export type EnsureRoomDesignSpecInput = {
  userId: string;
  roomId: string;
};

export type EnsureRoomDesignSpecResult = Exclude<RoomDesignSpecState, { status: "extraction_needed" }>;

// The /spec screen's entry point: persisted state, plus the on-demand backfill
// for rooms that predate specs. The one paid side effect a GET may have is the
// FIRST attempt for a concept; every later attempt needs an explicit Retry.
export async function ensureRoomDesignSpec(
  clients: Clients,
  { userId, roomId }: EnsureRoomDesignSpecInput,
  { defer, run = defaultRunner(clients), now = Date.now(), leaseMs = specExtractionLeaseMs() }: StartOptions
): Promise<EnsureRoomDesignSpecResult> {
  const state = await readRoomDesignSpec(clients, { roomId }, { now, leaseMs });
  if (state.status !== "extraction_needed") {
    return state;
  }

  const begun = await beginExtraction(clients, { userId, roomId, conceptId: state.conceptId }, { defer, run });
  if (!begun) {
    return { status: "extraction_failed", conceptId: state.conceptId, retryable: true };
  }
  return {
    status: "extraction_running",
    jobId: begun.jobId,
    startedAt: new Date(now).toISOString(),
    staleAt: new Date(now + leaseMs).toISOString()
  };
}

export type StartRoomDesignSpecExtractionResult =
  | { status: "started"; jobId: string }
  | { status: "already_running"; jobId: string }
  | { status: "already_ready" }
  | {
      status: "cannot_start";
      reason: "no_selected_concept" | "concept_image_unprepared" | "not_retryable" | "job_insert_failed";
    };

// The explicit starters (approval, Retry): both are POSTs, so a fresh attempt
// after a recorded failure is always a deliberate user action.
export async function startRoomDesignSpecExtraction(
  clients: Clients,
  { userId, roomId }: EnsureRoomDesignSpecInput,
  { defer, run = defaultRunner(clients), now = Date.now(), leaseMs = specExtractionLeaseMs() }: StartOptions
): Promise<StartRoomDesignSpecExtractionResult> {
  const state = await readRoomDesignSpec(clients, { roomId }, { now, leaseMs });
  switch (state.status) {
    case "ready":
      return { status: "already_ready" };
    case "extraction_running":
      return { status: "already_running", jobId: state.jobId };
    case "no_selected_concept":
      return { status: "cannot_start", reason: "no_selected_concept" };
    case "concept_image_unprepared":
      return { status: "cannot_start", reason: "concept_image_unprepared" };
    case "extraction_failed":
      if (!state.retryable) {
        return { status: "cannot_start", reason: "not_retryable" };
      }
      break;
    case "extraction_needed":
      break;
  }

  const begun = await beginExtraction(clients, { userId, roomId, conceptId: state.conceptId }, { defer, run });
  return begun ? { status: "started", jobId: begun.jobId } : { status: "cannot_start", reason: "job_insert_failed" };
}

type SpecExtractionJobSummary = { conceptId?: unknown };

// The detached runner. Re-derives everything from the job row (like the final
// render runner), so it is safe to invoke for any job id at any time: a row that
// is no longer a live lease never spends again, and a run that loses its lease
// mid-flight never writes the spec or the terminal status (see finalize).
export async function runRoomDesignSpecExtraction(
  serviceSupabase: ServiceSupabaseClient,
  { jobId }: { jobId: string },
  {
    // Injectable so the persisted transitions are testable without a live provider.
    extract = extractRoomDesignSpec
  }: { extract?: typeof extractRoomDesignSpec } = {}
): Promise<void> {
  const { data: job, error: jobError } = await serviceSupabase
    .from("ai_jobs")
    .select("id, status, room_id, input_summary")
    .eq("id", jobId)
    .maybeSingle();

  if (jobError) {
    throw new Error(jobError.message);
  }
  if (!job) {
    console.error(`Spec extraction runner: job ${jobId} not found; dropping.`);
    return;
  }
  if (job.status !== "running" && job.status !== "queued") {
    // Reclaimed as abandoned, or already reported: at-least-once safety.
    return;
  }

  const summary = ((job.input_summary ?? {}) as SpecExtractionJobSummary) ?? {};
  const conceptId = typeof summary.conceptId === "string" ? summary.conceptId : null;
  const roomId = job.room_id;

  type JobUpdate = Database["public"]["Tables"]["ai_jobs"]["Update"];
  let extraction: Awaited<ReturnType<typeof extract>> | null = null;

  // Honest cost: a paid call is spend whether or not its result was kept, and
  // the row says so on every exit.
  const spendFields = (): Pick<JobUpdate, "model" | "prompt_version" | "cost_estimate_usd"> =>
    extraction
      ? {
          model: extraction.model,
          prompt_version: extraction.promptVersion,
          cost_estimate_usd: extraction.textCostUsd ?? null
        }
      : {};

  // A run that lost its lease (a reader reclaimed it as abandoned) no longer
  // owns the terminal status. It records what happened and what it cost on
  // the row without touching the status the reclaim set.
  const recordLateOutcome = async (outcome: { status: "discarded" | "succeeded" | "failed"; message: string }) => {
    console.warn(`Spec extraction job ${jobId}: lease reclaimed before this run finished; ${outcome.status}: ${outcome.message}`);
    const { error } = await serviceSupabase
      .from("ai_jobs")
      .update({ ...spendFields(), output_summary: { conceptId, lateOutcome: outcome } })
      .eq("id", jobId)
      .neq("status", "running");
    if (error) {
      console.error(`Spec extraction job ${jobId}: late-outcome write failed: ${error.message}`);
    }
  };

  // Terminal writes are lease-owned: a status-conditional compare-and-swap
  // that lands only while this run still holds the lease. Zero rows means a
  // reader reclaimed it in the meantime, and the reclaim's verdict stands.
  const finalize = async (
    payload: JobUpdate & { status: "succeeded" | "failed" }
  ): Promise<"finalized" | "lost_lease" | "write_failed"> => {
    const { data, error } = await serviceSupabase
      .from("ai_jobs")
      .update(payload)
      .eq("id", jobId)
      .in("status", ["running", "queued"])
      .select("id");
    if (error) {
      console.error(`Spec extraction job ${jobId}: terminal write (${payload.status}) failed: ${error.message}`);
      return "write_failed";
    }
    if (!data || data.length === 0) {
      await recordLateOutcome({
        status: payload.status,
        message:
          payload.status === "failed"
            ? payload.error_message ?? "Spec extraction failed."
            : "spec stored, then the lease was found reclaimed; the Retry reads it back"
      });
      return "lost_lease";
    }
    return "finalized";
  };

  const fail = async (message: string) => {
    const payload = {
      status: "failed" as const,
      completed_at: new Date().toISOString(),
      error_message: message,
      ...spendFields()
    };
    // One immediate retry covers a transient blip; past that the lease expiry
    // reclaims the row, which is the honest state for a run that could not
    // report.
    if ((await finalize(payload)) === "write_failed") {
      await finalize(payload);
    }
  };

  if (!conceptId || !roomId) {
    await fail("Spec extraction job is missing its room or concept.");
    return;
  }

  try {
    const { data: room } = await serviceSupabase
      .from("rooms")
      .select("id, room_type")
      .eq("id", roomId)
      .maybeSingle();
    const { data: concept } = await serviceSupabase
      .from("concepts")
      .select("id, primary_image_asset_id")
      .eq("id", conceptId)
      .eq("room_id", roomId)
      .maybeSingle();
    if (!room || !concept) {
      throw new Error("Spec extraction job's room or concept no longer exists.");
    }

    const render = await conceptPrimaryRender(
      { supabase: serviceSupabase, serviceSupabase },
      concept.primary_image_asset_id
    );
    if (!render) {
      throw new Error("Concept render unavailable for extraction.");
    }

    const { data: designBrief } = await serviceSupabase
      .from("design_briefs")
      .select("style_notes, color_notes, functional_requirements, avoid_notes")
      .eq("room_id", roomId)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { data: measurements } = await serviceSupabase
      .from("room_measurements")
      .select("wall_length_cm, room_depth_cm, ceiling_height_cm")
      .eq("room_id", roomId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    extraction = await extract({
      roomType: room.room_type,
      conceptImage: {
        bytes: render.bytes,
        mimeType: render.mimeType
      },
      brief: {
        styleNotes: designBrief?.style_notes,
        colorNotes: designBrief?.color_notes,
        functionalRequirements: designBrief?.functional_requirements,
        avoidNotes: designBrief?.avoid_notes
      },
      measurements: measurements
        ? {
            wallLengthCm: measurements.wall_length_cm,
            roomDepthCm: measurements.room_depth_cm,
            ceilingHeightCm: measurements.ceiling_height_cm
          }
        : null
    });

    // Lease ownership is re-verified before anything is persisted: a run the
    // reader has already reclaimed as abandoned is dead by contract, so it
    // discards its result (spend recorded) instead of writing a spec the user
    // has been told to retry. The window between this check and the upsert is
    // sub-millisecond and can only race a first-write-wins write of a valid
    // spec, which the Retry then reads back.
    const { data: lease, error: leaseError } = await serviceSupabase
      .from("ai_jobs")
      .select("status")
      .eq("id", jobId)
      .maybeSingle();
    if (leaseError) {
      throw new Error(leaseError.message);
    }
    if (!lease || (lease.status !== "running" && lease.status !== "queued")) {
      await recordLateOutcome({
        status: "discarded",
        message: "extraction finished after the lease was reclaimed; the result was discarded"
      });
      return;
    }

    // First write wins (codex finding): ignoreDuplicates means a slower
    // duplicate run can never overwrite a row another run stored, and above all
    // can never reset a spec the user has already CONFIRMED. A stored malformed
    // row is repaired only through the explicit guarded transition below.
    const { data: inserted, error: insertError } = await serviceSupabase
      .from("room_design_specs")
      .upsert(
        {
          room_id: roomId,
          concept_id: conceptId,
          objects: extraction.objects,
          must_preserve: extraction.mustPreserve,
          status: "extracted",
          extraction_job_id: jobId
        },
        { onConflict: "room_id,concept_id", ignoreDuplicates: true }
      )
      .select("*")
      .maybeSingle();

    if (insertError) {
      throw new Error(insertError.message);
    }

    let storedByAnotherRun = false;
    let repairedStoredRow = false;

    if (inserted) {
      if (!parseRoomDesignSpecRow(inserted)) {
        throw new Error("Extracted spec did not validate after insert.");
      }
    } else {
      // Duplicate: another run (or a previously stored row) holds the slot.
      const { data: existingRow } = await serviceSupabase
        .from("room_design_specs")
        .select("*")
        .eq("room_id", roomId)
        .eq("concept_id", conceptId)
        .maybeSingle();
      if (existingRow && parseRoomDesignSpecRow(existingRow)) {
        storedByAnotherRun = true;
      } else {
        // Explicit guarded repair: only a still-EXTRACTED malformed row may be
        // replaced; a confirmed row is never touched by this path.
        const { data: repaired } = existingRow
          ? await serviceSupabase
              .from("room_design_specs")
              .update({
                objects: extraction.objects,
                must_preserve: extraction.mustPreserve,
                status: "extracted",
                extraction_job_id: jobId
              })
              .eq("id", existingRow.id)
              .eq("status", "extracted")
              .select("*")
              .maybeSingle()
          : { data: null };
        if (!repaired || !parseRoomDesignSpecRow(repaired)) {
          throw new Error("Stored spec could not be read or repaired after extraction.");
        }
        repairedStoredRow = true;
      }
    }

    const succeeded = {
      status: "succeeded" as const,
      completed_at: new Date().toISOString(),
      model: extraction.model,
      prompt_version: extraction.promptVersion,
      cost_estimate_usd: extraction.textCostUsd ?? null,
      output_summary: {
        conceptId,
        objectCount: extraction.objects.length,
        mustPreserveCount: extraction.mustPreserve.length,
        storedByAnotherRun,
        repairedStoredRow
      }
    };
    // The spec is stored, so readers return ready from the spec row and would
    // never reclaim this lease: the audit row must not stay `running`. One
    // immediate retry covers a transient blip; past that, close it failed with
    // the spend recorded and the truth in the message. A lost lease here means
    // a reader reclaimed the row during persistence; its verdict stands and the
    // late outcome (spec stored) is recorded beside it.
    let closed = await finalize(succeeded);
    if (closed === "write_failed") {
      closed = await finalize(succeeded);
    }
    if (closed === "write_failed") {
      await fail("Spec stored, but the job could not be closed as succeeded; the cost is recorded here.");
    }
  } catch (error) {
    await fail(error instanceof Error ? error.message : "Spec extraction failed.");
  }
}

export type ConfirmRoomDesignSpecInput = {
  roomId: string;
  specId: string;
  objects: unknown;
  mustPreserve: unknown;
};

export type ConfirmRoomDesignSpecResult =
  | { status: "invalid"; message: string }
  | { status: "not_found" }
  | { status: "confirmed" };

export async function confirmRoomDesignSpec(
  supabase: UserSupabaseClient,
  { roomId, specId, objects, mustPreserve }: ConfirmRoomDesignSpecInput
): Promise<ConfirmRoomDesignSpecResult> {
  const parsedObjects = designSpecObjectsSchema.safeParse(objects);
  if (!parsedObjects.success) {
    return { status: "invalid", message: "Every piece needs a name and a quantity of at least one." };
  }
  const parsedPreserve = designSpecMustPreserveSchema.safeParse(mustPreserve);
  if (!parsedPreserve.success) {
    return { status: "invalid", message: "Preserved-architecture notes must be short plain sentences." };
  }

  const { data: existing } = await supabase
    .from("room_design_specs")
    .select("id")
    .eq("id", specId)
    .eq("room_id", roomId)
    .maybeSingle();

  if (!existing) {
    return { status: "not_found" };
  }

  const { error } = await supabase
    .from("room_design_specs")
    .update({
      objects: parsedObjects.data,
      must_preserve: parsedPreserve.data,
      status: "confirmed"
    })
    .eq("id", specId)
    .eq("room_id", roomId);

  if (error) {
    throw new Error(error.message);
  }

  return { status: "confirmed" };
}
