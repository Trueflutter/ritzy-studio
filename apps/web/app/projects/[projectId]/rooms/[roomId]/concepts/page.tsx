import {
  ButtonLink,
  DecorativeRule,
  MarketingPanel,
  SectionEyebrow,
  SubmitButton,
  Textarea
} from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
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
  // The hero is the room's current direction — the selected concept, or the
  // most recent one. Older concepts are revisions kept as quiet history.
  const heroConcept = selectedConcept ?? conceptsWithImages[0] ?? null;
  const earlierConcepts = conceptsWithImages.filter((concept) => concept.id !== heroConcept?.id);
  const canGenerate = Boolean(designBrief && roomPhoto);

  const hero = heroConcept
    ? {
        ...heroConcept,
        ...splitDescription(heroConcept.description),
        critiques: critiquesByConcept.get(heroConcept.id) ?? [],
        isSelected: heroConcept.status === "selected"
      }
    : null;

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
            <SectionEyebrow>N° 10 — Concepts</SectionEyebrow>
            <DecorativeRule className="mt-5" />
            <h1 className="mt-6 font-display text-display-l font-light leading-[1.05] tracking-[-0.015em] text-ink">
              {hero ? "Your room, reimagined." : "Generate the first room direction."}
            </h1>
            <p className="mt-4 font-body text-body-m text-ink-muted">
              {project.name} · {room.name}
              {room.name === room.room_type ? null : ` · ${room.room_type}`}
            </p>
          </div>

          {hero ? (
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

        {!hero ? (
          <ConceptGenerationPanel
            autoGenerate={autogenerate === "1"}
            canGenerate={canGenerate}
            projectId={projectId}
            roomId={roomId}
          />
        ) : (
          <>
            <article className="mt-10">
              <MarketingPanel className="p-[14px]" elevation="float" tone="paper">
                <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-page">
                  {hero.signedUrl ? (
                    <Image
                      alt={`${hero.title} — generated concept for ${room.name}`}
                      className="h-full w-full object-cover"
                      height={1200}
                      priority
                      src={hero.signedUrl}
                      unoptimized
                      width={1600}
                    />
                  ) : (
                    <p className="font-display text-body-s italic text-error">render could not load</p>
                  )}
                </div>
              </MarketingPanel>

              <div className="mx-auto mt-10 max-w-[720px]">
                <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-accent-deep">
                  {hero.isSelected ? "Selected direction" : "Initial concept"}
                </p>
                <h2 className="mt-4 font-display text-display-m font-light italic leading-[1.1] text-ink">
                  {hero.title}
                </h2>
                {hero.rationale ? (
                  <p className="mt-6 whitespace-pre-line font-body text-body-l leading-relaxed text-ink-secondary text-justify">
                    {hero.rationale}
                  </p>
                ) : null}

                {hero.uncertainty ? (
                  <div className="mt-8 border-t border-line pt-6">
                    <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-accent-deep">
                      What we assumed
                    </p>
                    <p className="mt-3 font-body text-body-l leading-relaxed text-ink-secondary text-justify">
                      {hero.uncertainty}
                    </p>
                  </div>
                ) : null}

                {hero.critiques.length > 0 ? (
                  <div className="mt-8 border-t border-line pt-6">
                    <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                      Past critiques
                    </p>
                    <div className="mt-4 space-y-3">
                      {hero.critiques.map((critique) => (
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

                <div className="mt-10 border-t border-line pt-8">
                  <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-accent-deep">
                    If this direction works
                  </p>
                  <form action={selectConceptAction} className="mt-5">
                    <input name="projectId" type="hidden" value={projectId} />
                    <input name="roomId" type="hidden" value={roomId} />
                    <input name="conceptId" type="hidden" value={hero.id} />
                    <SubmitButton
                      className="w-full"
                      pendingLabel="Starting sourcing..."
                      variant="primary"
                    >
                      Proceed to sourcing
                    </SubmitButton>
                  </form>
                </div>

                <div className="mt-10 border-t border-line pt-8">
                  <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-accent-deep">
                    If you&rsquo;d like changes
                  </p>
                  <form action={reviseConceptAction} className="mt-5">
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
              </div>
            </article>

            {earlierConcepts.length > 0 ? (
              <section className="mt-16">
                <DecorativeRule />
                <p className="mt-6 font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                  Earlier versions
                </p>
                <p className="mt-3 max-w-[560px] font-body text-body-s text-ink-muted">
                  Previous directions for this room. Select one to bring it back as the current
                  concept.
                </p>
                <div className="mt-6 grid gap-6 md:grid-cols-3">
                  {earlierConcepts.map((concept) => (
                    <article className="border border-line bg-surface p-3" key={concept.id}>
                      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden bg-page">
                        {concept.signedUrl ? (
                          <Image
                            alt={`${concept.title} — earlier concept for ${room.name}`}
                            className="h-full w-full object-cover"
                            height={600}
                            src={concept.signedUrl}
                            unoptimized
                            width={800}
                          />
                        ) : (
                          <p className="font-display text-body-s italic text-error">
                            render could not load
                          </p>
                        )}
                      </div>
                      <h3 className="mt-4 font-display text-display-xs font-light italic leading-snug text-ink">
                        {concept.title}
                      </h3>
                      <form action={selectConceptAction} className="mt-4">
                        <input name="projectId" type="hidden" value={projectId} />
                        <input name="roomId" type="hidden" value={roomId} />
                        <input name="conceptId" type="hidden" value={concept.id} />
                        <SubmitButton
                          className="h-10 w-full px-4"
                          pendingLabel="Selecting..."
                          variant="secondary"
                        >
                          Make this the direction
                        </SubmitButton>
                      </form>
                    </article>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        )}

      </section>
    </main>
  );
}
