import {
  DecorativeRule,
  JourneyNav,
  SectionEyebrow,
  StudioHeader,
  SubmitButton,
  Textarea
} from "@ritzy-studio/ui";
import Image from "next/image";
import { notFound, redirect } from "next/navigation";

import { reviseConceptAction, selectConceptAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ConceptGenerationPanel } from "./concept-generation-panel";

export const dynamic = "force-dynamic";

function splitDescription(description: string | null) {
  if (!description) {
    return { rationale: "", uncertainty: "" };
  }

  const marker = "Uncertainty:";
  const index = description.indexOf(marker);
  if (index === -1) {
    return { rationale: description.trim(), uncertainty: "" };
  }

  return {
    rationale: description.slice(0, index).trim(),
    uncertainty: description.slice(index + marker.length).trim()
  };
}

function publicConceptMessage(message: string | undefined) {
  if (!message) {
    return null;
  }

  const lower = message.toLowerCase();
  if (
    lower.includes("catalogue-grounded concept generation") ||
    lower.includes("top catalogue candidate") ||
    lower.includes("requested style cue") ||
    lower.includes("requested material cue") ||
    lower.includes("requested shape cue") ||
    lower.includes("attribute score")
  ) {
    return "We are refining the catalogue match for this room direction. Try again in a moment.";
  }

  return message;
}

export default async function ConceptsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string; roomId: string }>;
  searchParams: Promise<{ autogenerate?: string; message?: string }>;
}) {
  const { projectId, roomId } = await params;
  const { autogenerate, message } = await searchParams;
  const displayMessage = publicConceptMessage(message);
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  const { data: room } = await supabase
    .from("rooms")
    .select("*")
    .eq("id", roomId)
    .eq("project_id", projectId)
    .single();

  if (!project || !room) {
    notFound();
  }

  const serviceSupabase = createServiceClient();
  const { data: designBrief } = await supabase
    .from("design_briefs")
    .select("id")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: roomPhoto } = await supabase
    .from("room_assets")
    .select("id, storage_path")
    .eq("room_id", roomId)
    .eq("asset_type", "room_photo")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  const { data: concepts = [] } = await supabase
    .from("concepts")
    .select("*, primary_image_asset:room_assets!concepts_primary_image_asset_id_fkey(*)")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  const conceptIds = (concepts ?? []).map((concept) => concept.id);
  const { data: critiques = [] } = conceptIds.length
    ? await supabase
        .from("concept_critiques")
        .select("*")
        .in("concept_id", conceptIds)
        .order("created_at", { ascending: true })
    : { data: [] };

  const critiquesByConcept = new Map<string, typeof critiques>();
  for (const critique of critiques ?? []) {
    const existing = critiquesByConcept.get(critique.concept_id) ?? [];
    existing.push(critique);
    critiquesByConcept.set(critique.concept_id, existing);
  }

  const conceptsWithImages = await Promise.all(
    (concepts ?? []).map(async (concept) => {
      const asset = concept.primary_image_asset;
      if (!asset?.storage_path) {
        return { ...concept, signedUrl: null };
      }

      const { data } = await serviceSupabase.storage
        .from("generated-renders")
        .createSignedUrl(asset.storage_path, 60 * 60);

      return { ...concept, signedUrl: data?.signedUrl ?? null };
    })
  );

  const selectedConcept = conceptsWithImages.find((concept) => concept.status === "selected") ?? null;
  // The hero is the room's current direction — the selected concept, or the
  // most recent one. Older concepts are revisions kept as quiet history.
  const heroConcept = selectedConcept ?? conceptsWithImages[0] ?? null;
  const earlierConcepts = conceptsWithImages.filter((concept) => concept.id !== heroConcept?.id);
  const canGenerate = Boolean(designBrief && roomPhoto);

  const viewCaptions: Record<string, string> = {
    reverse_wide: "From the other end of the room",
    anchor_detail: "The anchor group, up close"
  };
  const { data: heroViewAssets = [] } = heroConcept
    ? await supabase
        .from("room_assets")
        .select("*")
        .eq("concept_id", heroConcept.id)
        .not("view_key", "is", null)
        .order("created_at", { ascending: true })
    : { data: [] };
  const heroViews = await Promise.all(
    (heroViewAssets ?? []).map(async (asset) => {
      const { data } = await serviceSupabase.storage
        .from("generated-renders")
        .createSignedUrl(asset.storage_path, 60 * 60);

      return {
        id: asset.id,
        viewKey: asset.view_key ?? "",
        caption: viewCaptions[asset.view_key ?? ""] ?? "Another view",
        signedUrl: data?.signedUrl ?? null
      };
    })
  );

  // "Your room, as it is" — the original photograph, shown desaturated beside the
  // concept views so the designer can read the render against the real space.
  const originalRoomPhotoUrl =
    heroConcept && roomPhoto?.storage_path
      ? (
          await supabase.storage
            .from("room-assets")
            .createSignedUrl(roomPhoto.storage_path, 60 * 60)
        ).data?.signedUrl ?? null
      : null;

  const heroThumbs: Array<{ id: string; caption: string; signedUrl: string | null; muted?: boolean }> = [
    ...heroViews.map((view) => ({ id: view.id, caption: view.caption, signedUrl: view.signedUrl })),
    ...(originalRoomPhotoUrl || roomPhoto
      ? [
          {
            id: "original-room-photo",
            caption: "Your room, as it is",
            signedUrl: originalRoomPhotoUrl,
            muted: true
          }
        ]
      : [])
  ];

  const conceptVersion = conceptsWithImages.length;

  const hero = heroConcept
    ? {
        ...heroConcept,
        ...splitDescription(heroConcept.description),
        critiques: critiquesByConcept.get(heroConcept.id) ?? [],
        isSelected: heroConcept.status === "selected"
      }
    : null;

  if (!hero) {
    return (
      <main className="min-h-dvh bg-page text-ink">
        <StudioHeader>
          <JourneyNav current="concepts" />
        </StudioHeader>

        <section className="mx-auto max-w-[1040px] px-5 py-12 md:px-8 lg:px-12">
          <SectionEyebrow>N° 10 — Concepts</SectionEyebrow>
          <DecorativeRule className="mt-5" />
          <h1 className="mt-6 font-display text-[48px] font-light leading-[1.05] tracking-[-0.015em] text-ink">
            Generate the first room <em className="italic">direction.</em>
          </h1>
          <p className="mt-4 font-body text-body-m text-ink-muted">
            {project.name} · {room.name}
            {room.name === room.room_type ? null : ` · ${room.room_type}`}
          </p>

          {displayMessage ? (
            <p className="mt-8 border border-line bg-surface px-4 py-3 font-display text-body-m italic text-ink-secondary">
              {displayMessage}
            </p>
          ) : null}

          <ConceptGenerationPanel
            autoGenerate={autogenerate === "1"}
            canGenerate={canGenerate}
            projectId={projectId}
            roomId={roomId}
          />
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-page text-ink">
      <StudioHeader>
        <JourneyNav current="concepts" />
      </StudioHeader>

      <div className="grid grid-cols-1 border-b border-line lg:grid-cols-[minmax(0,1fr)_400px]">
        {/* image column — the render dominates */}
        <div className="bg-surface lg:border-r lg:border-line">
          <div className="h-[380px] overflow-hidden md:h-[520px] lg:h-[660px]">
            {hero.signedUrl ? (
              <Image
                alt={`${hero.title} — generated concept for ${room.name}`}
                className="h-full w-full object-cover"
                height={1320}
                priority
                src={hero.signedUrl}
                unoptimized
                width={1600}
              />
            ) : (
              <p className="flex h-full items-center justify-center font-display text-body-s italic text-error">
                render could not load
              </p>
            )}
          </div>

          {heroThumbs.length > 0 ? (
            <div className="grid grid-cols-3 gap-px border-t border-line bg-line">
              {heroThumbs.map((thumb) => (
                <figure className="m-0 bg-surface" key={thumb.id}>
                  <div className="h-[130px] overflow-hidden md:h-[170px]">
                    {thumb.signedUrl ? (
                      <Image
                        alt={`${hero.title} — ${thumb.caption.toLowerCase()}`}
                        className={`h-full w-full object-cover${thumb.muted ? " [filter:grayscale(0.25)]" : ""}`}
                        height={340}
                        src={thumb.signedUrl}
                        unoptimized
                        width={340}
                      />
                    ) : (
                      <p className="flex h-full items-center justify-center px-2 text-center font-display text-caption italic text-error">
                        view could not load
                      </p>
                    )}
                  </div>
                  <figcaption
                    className={`px-4 pb-4 pt-3 font-body text-caption-tight font-medium uppercase tracking-[0.28em] ${
                      thumb.muted ? "text-ink-subtle" : "text-ink-muted"
                    }`}
                  >
                    {thumb.caption}
                  </figcaption>
                </figure>
              ))}
            </div>
          ) : null}
        </div>

        {/* editorial rail — rationale reads as a note, decisions live in the margin */}
        <aside className="flex flex-col bg-page px-6 py-11 md:px-10">
          <SectionEyebrow>
            N° 10 — Concepts · Version {conceptVersion}
          </SectionEyebrow>
          <DecorativeRule className="mt-4" />
          <h1 className="mt-6 font-display text-[40px] font-light italic leading-[1.08] text-ink">
            {hero.title}
          </h1>

          {displayMessage ? (
            <p className="mt-6 border border-line bg-surface px-4 py-3 font-display text-body-s italic text-ink-secondary">
              {displayMessage}
            </p>
          ) : null}

          {hero.rationale ? (
            <p className="mt-6 whitespace-pre-line font-body text-body-m leading-[1.7] text-ink-secondary">
              {hero.rationale}
            </p>
          ) : null}

          {hero.uncertainty ? (
            <div className="mt-7 border-t border-line-strong pt-5">
              <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-accent-deep">
                What we assumed
              </p>
              <p className="mt-3 font-display text-body-l italic leading-[1.6] text-ink-secondary">
                {hero.uncertainty}
              </p>
            </div>
          ) : null}

          {hero.critiques.length > 0 ? (
            <div className="mt-7 border-t border-line-strong pt-5">
              <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                Past critiques
              </p>
              <div className="mt-4 space-y-3">
                {hero.critiques.map((critique) => (
                  <p
                    className="border border-line bg-surface px-4 py-3 font-display text-body-s italic text-ink-secondary"
                    key={critique.id}
                  >
                    {critique.critique_text}
                  </p>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-7 flex flex-col gap-3 border-t border-line-strong pt-5">
            <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              If this direction works
            </p>
            <form action={selectConceptAction}>
              <input name="projectId" type="hidden" value={projectId} />
              <input name="roomId" type="hidden" value={roomId} />
              <input name="conceptId" type="hidden" value={hero.id} />
              <SubmitButton className="w-full" pendingLabel="Starting sourcing..." variant="primary">
                Proceed to sourcing
              </SubmitButton>
            </form>
          </div>

          <div className="mt-6 flex flex-col gap-3 border-t border-line-strong pt-5">
            <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              If you&rsquo;d like changes
            </p>
            <form action={reviseConceptAction}>
              <input name="projectId" type="hidden" value={projectId} />
              <input name="roomId" type="hidden" value={roomId} />
              <input name="conceptId" type="hidden" value={hero.id} />
              <Textarea
                id={`critique-${hero.id}`}
                label="Describe what to change"
                name="critique"
                placeholder="make the palette warmer, keep the sofa placement, reduce ornament..."
              />
              <SubmitButton className="w-full" pendingLabel="Generating revision..." variant="secondary">
                Generate revision
              </SubmitButton>
            </form>
          </div>
        </aside>
      </div>

      {earlierConcepts.length > 0 ? (
        <section className="bg-page px-5 py-11 md:px-8 lg:px-12">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
            <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              Earlier versions
            </p>
            <p className="font-display text-button-quiet italic text-ink-subtle">
              kept as quiet history — select one to bring it back
            </p>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-5 sm:grid-cols-3 lg:grid-cols-4">
            {earlierConcepts.map((concept) => (
              <figure className="m-0" key={concept.id}>
                <div className="h-[150px] overflow-hidden border border-line md:h-[170px]">
                  {concept.signedUrl ? (
                    <Image
                      alt={`${concept.title} — earlier concept for ${room.name}`}
                      className="h-full w-full object-cover opacity-95"
                      height={340}
                      src={concept.signedUrl}
                      unoptimized
                      width={454}
                    />
                  ) : (
                    <p className="flex h-full items-center justify-center font-display text-caption italic text-error">
                      render could not load
                    </p>
                  )}
                </div>
                <figcaption className="mt-[10px] flex items-baseline justify-between gap-3">
                  <span className="font-body text-caption-tight font-medium uppercase tracking-[0.28em] text-ink-muted">
                    {concept.title}
                  </span>
                  <form action={selectConceptAction}>
                    <input name="projectId" type="hidden" value={projectId} />
                    <input name="roomId" type="hidden" value={roomId} />
                    <input name="conceptId" type="hidden" value={concept.id} />
                    <SubmitButton
                      className="whitespace-nowrap"
                      pendingLabel="Restoring…"
                      trailing="→"
                      variant="quiet"
                    >
                      restore
                    </SubmitButton>
                  </form>
                </figcaption>
              </figure>
            ))}
            <div className="flex h-[150px] items-center justify-center border border-dashed border-line-strong md:h-[170px]">
              <p className="font-display text-body-m italic text-ink-subtle">
                version {conceptVersion} is current
              </p>
            </div>
          </div>
        </section>
      ) : null}
    </main>
  );
}
