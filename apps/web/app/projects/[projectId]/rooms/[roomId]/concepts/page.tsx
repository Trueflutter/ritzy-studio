import { ButtonLink, SubmitButton, Textarea } from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  reviseConceptAction,
  selectConceptAction
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { ConceptGenerationPanel } from "./concept-generation-panel";

export const dynamic = "force-dynamic";

export default async function ConceptsPage({
  params,
  searchParams
}: {
  params: Promise<{ projectId: string; roomId: string }>;
  searchParams: Promise<{ autogenerate?: string; message?: string }>;
}) {
  const { projectId, roomId } = await params;
  const { autogenerate, message } = await searchParams;
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
    .select("id")
    .eq("room_id", roomId)
    .eq("asset_type", "room_photo")
    .limit(1)
    .maybeSingle();

  const { data: concepts = [] } = await supabase
    .from("concepts")
    .select("*, primary_image_asset:room_assets(*)")
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

  const canGenerate = Boolean(designBrief && roomPhoto);

  return (
    <main className="min-h-dvh bg-page text-ink">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <ButtonLink href="/" leading="←" variant="chrome">
          Back to studio
        </ButtonLink>
      </header>

      <section className="mx-auto max-w-[1280px] px-5 py-8 md:px-8 lg:px-12 xl:px-16">
        <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
          Project — Photos — Brief — Generate — Critique — Match
        </p>
        <div className="mt-3 h-px w-32 bg-ink" />

        <div className="mt-10 flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-[860px]">
            <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              N° 05 — Initial Concepts
            </p>
            <h1 className="mt-4 font-display text-display-l font-light leading-[1.05] tracking-[-0.015em] text-ink">
              {conceptsWithImages.length === 0
                ? "Generate the first room direction."
                : conceptsWithImages.length === 1
                  ? "Your first room direction."
                  : "Review the room directions."}
            </h1>
            <p className="mt-4 font-body text-body-m text-ink-muted">
              {project.name} · {room.name} · {room.room_type}
            </p>
          </div>

          {conceptsWithImages.length > 0 ? (
            <ButtonLink
              href={`/projects/${projectId}/rooms/${roomId}/brief`}
              leading="←"
              variant="chrome"
            >
              Refine the brief
            </ButtonLink>
          ) : null}
        </div>

        {message ? (
          <p className="mt-8 border border-line bg-surface px-4 py-3 font-display text-body-m italic text-ink-secondary">
            {message}
          </p>
        ) : null}

        {conceptsWithImages.length === 0 ? (
          <ConceptGenerationPanel
            autoGenerate={autogenerate === "1"}
            canGenerate={canGenerate}
            projectId={projectId}
            roomId={roomId}
          />
        ) : null}

        {conceptsWithImages.length === 1 ? (
          (() => {
            const concept = conceptsWithImages[0];
            const conceptCritiques = critiquesByConcept.get(concept.id) ?? [];
            const isSelected = concept.status === "selected";

            return (
              <article className="mt-12 border border-line bg-surface p-[14px]">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-page">
                  {concept.signedUrl ? (
                    <Image
                      alt={`${concept.title} generated room concept`}
                      className="h-full w-full object-cover"
                      height={1200}
                      unoptimized
                      priority
                      src={concept.signedUrl}
                      width={1600}
                    />
                  ) : (
                    <p className="font-display text-body-s italic text-error">
                      render could not load
                    </p>
                  )}
                </div>
                <div className="mx-auto mt-5 max-w-[880px] border-t border-line px-6 pb-8 pt-10 md:px-10">
                  <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                    {isSelected ? "Selected" : "Initial concept"}
                  </p>
                  <h2 className="mt-5 font-display text-display-m font-light italic text-ink">
                    {concept.title}
                  </h2>
                  {concept.description ? (
                    <p className="mt-6 whitespace-pre-line font-body text-body-l text-ink-secondary">
                      {concept.description}
                    </p>
                  ) : null}

                  {conceptCritiques.length > 0 ? (
                    <div className="mt-10 border-t border-line pt-8">
                      <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                        Past critiques
                      </p>
                      <div className="mt-5 space-y-3">
                        {conceptCritiques.map((critique) => (
                          <p
                            className="border border-line bg-page px-5 py-4 font-display text-body-m italic text-ink-secondary"
                            key={critique.id}
                          >
                            {critique.critique_text}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="mt-10 grid gap-6 border-t border-line pt-8 md:grid-cols-2">
                    <form action={selectConceptAction} className="flex flex-col md:justify-end">
                      <input name="projectId" type="hidden" value={projectId} />
                      <input name="roomId" type="hidden" value={roomId} />
                      <input name="conceptId" type="hidden" value={concept.id} />
                      <SubmitButton
                        className="w-full"
                        disabled={isSelected}
                        pendingLabel="Selecting..."
                        variant={isSelected ? "secondary" : "primary"}
                      >
                        {isSelected ? "Selected" : "Select concept"}
                      </SubmitButton>
                    </form>

                    <form action={reviseConceptAction} className="flex flex-col">
                      <input name="projectId" type="hidden" value={projectId} />
                      <input name="roomId" type="hidden" value={roomId} />
                      <input name="conceptId" type="hidden" value={concept.id} />
                      <Textarea
                        id={`critique-${concept.id}`}
                        label="Or describe what to change"
                        name="critique"
                        placeholder="make the palette warmer, keep the sofa placement, reduce ornament..."
                      />
                      <SubmitButton className="w-full" pendingLabel="Generating revision..." variant="secondary">
                        Generate revision
                      </SubmitButton>
                    </form>
                  </div>
                </div>
              </article>
            );
          })()
        ) : conceptsWithImages.length > 1 ? (
          <div className="mt-12 grid gap-6 md:grid-cols-2">
            {conceptsWithImages.map((concept) => {
              const conceptCritiques = critiquesByConcept.get(concept.id) ?? [];
              const isSelected = concept.status === "selected";

              return (
                <article className="border border-line bg-surface p-[14px]" key={concept.id}>
                  <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-page">
                    {concept.signedUrl ? (
                      <Image
                        alt={`${concept.title} generated room concept`}
                        className="h-full w-full object-cover"
                        height={900}
                        unoptimized
                        src={concept.signedUrl}
                        width={1200}
                      />
                    ) : (
                      <p className="font-display text-body-s italic text-error">
                        render could not load
                      </p>
                    )}
                  </div>
                  <div className="mt-5 border-t border-line px-[18px] pb-[18px] pt-5">
                    <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                      {isSelected ? "Selected" : "Concept"}
                    </p>
                    <h2 className="mt-3 font-display text-display-xs font-light italic text-ink">
                      {concept.title}
                    </h2>
                    {concept.description ? (
                      <p className="mt-4 whitespace-pre-line font-body text-body-s text-ink-secondary">
                        {concept.description}
                      </p>
                    ) : null}

                    {conceptCritiques.length > 0 ? (
                      <div className="mt-6 border-t border-line pt-5">
                        <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                          Past critiques
                        </p>
                        <div className="mt-4 space-y-3">
                          {conceptCritiques.map((critique) => (
                            <p
                              className="border border-line bg-page px-4 py-3 font-display text-body-s italic text-ink-secondary"
                              key={critique.id}
                            >
                              {critique.critique_text}
                            </p>
                          ))}
                        </div>
                      </div>
                    ) : null}

                    <form action={selectConceptAction} className="mt-6 border-t border-line pt-5">
                      <input name="projectId" type="hidden" value={projectId} />
                      <input name="roomId" type="hidden" value={roomId} />
                      <input name="conceptId" type="hidden" value={concept.id} />
                      <SubmitButton
                        className="w-full"
                        disabled={isSelected}
                        pendingLabel="Selecting..."
                        variant={isSelected ? "secondary" : "primary"}
                      >
                        {isSelected ? "Selected" : "Select concept"}
                      </SubmitButton>
                    </form>

                    <form action={reviseConceptAction} className="mt-4">
                      <input name="projectId" type="hidden" value={projectId} />
                      <input name="roomId" type="hidden" value={roomId} />
                      <input name="conceptId" type="hidden" value={concept.id} />
                      <Textarea
                        id={`critique-${concept.id}`}
                        label="Or describe what to change"
                        name="critique"
                        placeholder="make the palette warmer, keep the sofa placement, reduce ornament..."
                      />
                      <SubmitButton className="w-full" pendingLabel="Generating revision..." variant="secondary">
                        Generate revision
                      </SubmitButton>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}

        {selectedConcept ? (
          <section className="mt-16 flex flex-col gap-6 border-t border-line pt-10 md:flex-row md:items-end md:justify-between">
            <div className="max-w-[680px]">
              <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                N° 06 — Product Matching
              </p>
              <h2 className="mt-4 font-display text-display-m font-light italic text-ink">
                Next, source the shopping plan.
              </h2>
              <p className="mt-3 max-w-[560px] font-body text-body-s text-ink-secondary">
                Open product matching for the selected concept. Catalog products, prices, and
                retailer links follow.
              </p>
            </div>
            <ButtonLink
              className="shrink-0"
              href={`/projects/${projectId}/rooms/${roomId}/product-matching`}
              trailing="→"
            >
              Continue to sourcing
            </ButtonLink>
          </section>
        ) : null}
      </section>
    </main>
  );
}
