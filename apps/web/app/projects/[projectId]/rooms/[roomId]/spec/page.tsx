import { DecorativeRule, JourneyNav, SectionEyebrow, StudioHeader } from "@ritzy-studio/ui";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";

import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ensureRoomDesignSpec } from "@/lib/services/design-spec";
import { SpecLedgerForm } from "./spec-ledger-form";

export const dynamic = "force-dynamic";

// The spec confirmation screen (S2): the design, as editable truth. Extraction
// runs on first open (Suspense-streamed), so every room that predates specs
// backfills itself the first time this screen or sourcing is reached.

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
              <p className="mt-3 font-body text-body-s text-ink-muted">
                First visit extracts the spec from the render. This takes a moment.
              </p>
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

  const result = await ensureRoomDesignSpec({ supabase, serviceSupabase }, { userId, roomId });

  if (result.status === "no_selected_concept") {
    redirect(
      `/projects/${projectId}/rooms/${roomId}/concepts?message=${encodeURIComponent(
        "Select a concept first; the spec is read from the approved direction."
      )}`
    );
  }

  if (result.status === "concept_image_unprepared" || result.status === "extraction_failed") {
    return (
      <div className="mt-10 border border-error bg-surface px-8 py-12 text-center">
        <p className="font-display text-display-xs font-light italic text-ink">
          the spec could not be read yet
        </p>
        <p className="mx-auto mt-3 max-w-[440px] font-body text-body-s text-ink-secondary">
          {result.status === "extraction_failed"
            ? "Reading the approved concept failed. Your concept and brief are untouched."
            : "The approved concept image is not ready to read. Your concept and brief are untouched."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <a
            className="inline-block border border-ink bg-ink px-6 py-3 font-body text-caption font-medium uppercase tracking-[0.32em] text-paper"
            href={`/projects/${projectId}/rooms/${roomId}/spec`}
          >
            Retry
          </a>
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

  const { data: concept } = await supabase
    .from("concepts")
    .select("id, title, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(storage_path)")
    .eq("id", result.spec.conceptId)
    .maybeSingle();

  let renderUrl: string | null = null;
  if (concept?.primary_image_asset?.storage_path) {
    const { data: signed } = await serviceSupabase.storage
      .from("generated-renders")
      .createSignedUrl(concept.primary_image_asset.storage_path, 60 * 60);
    renderUrl = signed?.signedUrl ?? null;
  }

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
