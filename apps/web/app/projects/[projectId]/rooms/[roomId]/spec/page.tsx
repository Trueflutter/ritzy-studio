import { DecorativeRule, JourneyNav, SectionEyebrow, StudioHeader, SubmitButton } from "@ritzy-studio/ui";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { after } from "next/server";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { confirmDesignSpecAction, retryDesignSpecExtractionAction } from "@/app/actions";
import { ensureRoomDesignSpec } from "@/lib/services/design-spec";
import { SpecExtractionRefresh } from "./spec-extraction-refresh";
import { SpecLedgerForm } from "./spec-ledger-form";

export const dynamic = "force-dynamic";
// The first touch of this screen schedules the paid spec extraction as an
// after() task on THIS route's function (and Retry's action runs here too), so
// the function budget must outlast the provider deadline: 90s text timeout plus
// overhead, see lib/spec-extraction, whose SPEC_EXTRACTION_ROUTE_MAX_DURATION_S
// mirrors this literal (segment config cannot be imported).
export const maxDuration = 300;

// The spec confirmation screen (S2): the design, as editable truth. The page only
// READS persisted state (PR #332 review fix): approval starts the extraction, a
// room that predates specs starts its one first-touch attempt here, and the
// running state polls until the detached runner has stored the spec.

// The detached runner is scheduled on this request's after() so it outlives the
// response and cannot be aborted by the browser leaving. Its own failures are
// recorded on the job row; anything escaping that is logged, never rethrown
// into the render.
function deferSpecExtraction(task: () => Promise<void>) {
  after(() =>
    task().catch((error) => {
      console.error("Deferred spec extraction failed to run.", error);
    })
  );
}

export default async function SpecPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string; roomId: string }>;
  searchParams: Promise<{ message?: string }>;
}) {
  const { projectId, roomId } = await params;
  const { message } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError || !user) {
    redirect("/login");
  }

  const { data: room } = await supabase
    .from("rooms")
    .select("id, name, room_type, project:projects(id, name)")
    .eq("id", roomId)
    .single();

  if (!room || room.project?.id !== projectId) {
    notFound();
  }

  return (
    <main className="min-h-dvh bg-page text-ink">
      <StudioHeader>
        <JourneyNav current="concepts" />
      </StudioHeader>

      <section className="mx-auto max-w-[1040px] px-5 py-12 md:px-8 lg:px-12">
        <SectionEyebrow>N° 12 — Design Spec</SectionEyebrow>
        <DecorativeRule className="mt-5" />
        <h1 className="mt-6 font-display text-[48px] font-light leading-[1.05] tracking-[-0.015em] text-ink">
          The design, as a <em className="italic">checklist.</em>
        </h1>
        <p className="mt-[18px] max-w-[620px] font-body text-body-m leading-[1.65] text-ink-secondary">
          Read from your approved concept. Adjust anything before sourcing: the pieces below are what
          the shopping list will be built to match.
        </p>
        <p className="mt-2 font-body text-body-s text-ink-muted">
          {room.project?.name} · {room.name}
          {room.name === room.room_type ? null : ` · ${room.room_type}`}
        </p>

        {message ? (
          <p className="mt-8 border border-line bg-surface px-4 py-3 font-display text-body-m italic text-ink-secondary">
            {message}
          </p>
        ) : null}

        <Suspense
          fallback={
            <div className="mt-10 border border-line bg-surface px-8 py-14 text-center">
              <p aria-live="polite" className="font-display text-display-xs font-light italic text-ink">
                reading the approved concept…
              </p>
              <p className="mt-3 font-body text-body-s text-ink-muted">Checking what the design contains.</p>
            </div>
          }
        >
          <SpecLedgerSection projectId={projectId} roomId={roomId} userId={user.id} />
        </Suspense>
      </section>
    </main>
  );
}

async function SpecLedgerSection({
  projectId,
  roomId,
  userId
}: {
  projectId: string;
  roomId: string;
  userId: string;
}) {
  const supabase = await createClient();
  const serviceSupabase = createServiceClient();
  const specPath = `/projects/${projectId}/rooms/${roomId}/spec`;

  const result = await ensureRoomDesignSpec(
    { supabase, serviceSupabase },
    { userId, roomId },
    { defer: deferSpecExtraction }
  );

  if (result.status === "no_selected_concept") {
    redirect(
      `/projects/${projectId}/rooms/${roomId}/concepts?message=${encodeURIComponent(
        "Select a concept first; the spec is read from the approved direction."
      )}`
    );
  }

  if (result.status === "extraction_running") {
    return (
      <div className="mt-10 border border-line bg-surface px-8 py-14 text-center">
        <SpecExtractionRefresh staleAtMs={Date.parse(result.staleAt)} />
        <p aria-live="polite" className="font-display text-display-xs font-light italic text-ink">
          reading the approved concept…
        </p>
        <p className="mt-3 font-body text-body-s text-ink-muted">
          Listing every piece in the render. This page updates on its own.
        </p>
        <a
          className="mt-6 inline-block font-display text-body-m italic text-ink-secondary underline-offset-4 hover:underline"
          href={specPath}
        >
          Refresh
        </a>
      </div>
    );
  }

  if (result.status === "concept_image_unprepared" || result.status === "extraction_failed") {
    const retryable = result.status === "extraction_failed" && result.retryable;
    return (
      <div className="mt-10 border border-error bg-surface px-8 py-12 text-center">
        <p className="font-display text-display-xs font-light italic text-ink">
          the spec could not be read yet
        </p>
        <p className="mx-auto mt-3 max-w-[440px] font-body text-body-s text-ink-secondary">
          {result.status === "extraction_failed"
            ? retryable
              ? "Reading the approved concept did not finish. Your concept and brief are untouched."
              : "The confirmed spec could not be read back. Your concept and brief are untouched."
            : "The approved concept image is not ready to read. Your concept and brief are untouched."}
        </p>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {retryable ? (
            <form action={retryDesignSpecExtractionAction}>
              <input name="projectId" type="hidden" value={projectId} />
              <input name="roomId" type="hidden" value={roomId} />
              <SubmitButton pendingLabel="Starting...">Retry</SubmitButton>
            </form>
          ) : null}
          <a
            className="inline-block border border-ink px-6 py-3 font-body text-caption font-medium uppercase tracking-[0.32em] text-ink"
            href={`/projects/${projectId}/rooms/${roomId}/concepts`}
          >
            Back to concepts
          </a>
          <a
            className="inline-block border border-line px-6 py-3 font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-secondary"
            href={`/projects/${projectId}/rooms/${roomId}/product-matching`}
          >
            Continue to sourcing without the spec
          </a>
        </div>
      </div>
    );
  }

  const renderUrl = result.renderSignedUrl;

  return (
    <div className="mt-10">
      {renderUrl ? (
        <div className="relative aspect-[16/9] w-full overflow-hidden border border-line">
          <Image
            alt={`Approved concept: ${result.conceptTitle}`}
            className="object-cover"
            fill
            sizes="(min-width: 1040px) 976px, 100vw"
            src={renderUrl}
            unoptimized
          />
        </div>
      ) : null}
      <SpecLedgerForm
        action={confirmDesignSpecAction}
        conceptTitle={result.conceptTitle}
        extracted={result.spec.status === "extracted"}
        mustPreserve={result.spec.mustPreserve}
        objects={result.spec.objects}
        projectId={projectId}
        roomId={roomId}
        specId={result.spec.id}
      />
    </div>
  );
}
