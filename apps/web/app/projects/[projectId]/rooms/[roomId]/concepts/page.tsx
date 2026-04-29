import { Button, ButtonLink, Textarea } from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import {
  generateInitialConceptAction,
  reviseConceptAction,
  selectConceptAction
} from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function ConceptsPage({
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

      const { data } = await supabase.storage
        .from("generated-renders")
        .createSignedUrl(asset.storage_path, 60 * 60);

      return { ...concept, signedUrl: data?.signedUrl ?? null };
    })
  );

  const canGenerate = Boolean(designBrief && roomPhoto);

  return (
    <main className="min-h-dvh bg-page text-ink">
      <header className="flex min-h-20 items-center justify-between border-b border-line bg-surface px-5 md:px-8 lg:px-12 xl:px-16">
        <Link className="font-display text-[28px] font-light text-ink" href="/">
          Ri <span className="font-body text-caption font-medium uppercase text-ink-muted">Ritzy Studio</span>
        </Link>
        <ButtonLink href="/" trailing="→" variant="quiet">
          back to studio
        </ButtonLink>
      </header>

      <section className="mx-auto max-w-[1120px] px-5 py-12 md:px-8 lg:px-12 xl:px-16">
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div>
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Project — Photos — Brief — Generate — Critique — Match
            </p>
            <div className="mt-3 h-px w-32 bg-ink" />

            <p className="mt-12 font-body text-caption font-medium uppercase text-ink-muted">
              N° 05 — Initial Concepts
            </p>
            <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
              Generate the first room direction.
            </h1>
            <p className="mt-6 max-w-[640px] font-body text-body-m text-ink-secondary">
              {project.name} · {room.name} · {room.room_type}
            </p>

            {message ? (
              <p className="mt-8 border border-line bg-surface px-4 py-3 font-display text-body-s italic text-ink-secondary">
                {message}
              </p>
            ) : null}
          </div>

          <aside className="border border-line bg-surface p-5 lg:self-start">
            <p className="font-body text-caption font-medium uppercase text-ink-muted">
              Generation Status
            </p>
            <div className="mt-3 h-px w-20 bg-ink" />
            <p className="mt-6 font-display text-display-xs font-light italic text-ink">
              {canGenerate ? "brief and room photo ready" : "brief and room photo required"}
            </p>
            <form action={generateInitialConceptAction} className="mt-8">
              <input name="projectId" type="hidden" value={projectId} />
              <input name="roomId" type="hidden" value={roomId} />
              <Button className="w-full" disabled={!canGenerate} type="submit">
                Generate concept
              </Button>
            </form>
            <ButtonLink
              className="mt-6 w-full"
              href={`/projects/${projectId}/rooms/${roomId}/brief`}
              variant="quiet"
            >
              refine brief
            </ButtonLink>
          </aside>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2">
          {conceptsWithImages.length > 0 ? (
            conceptsWithImages.map((concept) => (
              <article className="border border-line bg-surface p-4" key={concept.id}>
                <div className="flex aspect-[3/2] items-center justify-center bg-page">
                  {concept.signedUrl ? (
                    <Image
                      alt={`${concept.title} generated room concept`}
                      className="h-full w-full object-cover"
                      height={768}
                      unoptimized
                      src={concept.signedUrl}
                      width={1152}
                    />
                  ) : (
                    <p className="font-display text-body-s italic text-error">
                      render could not load
                    </p>
                  )}
                </div>
                <p className="mt-5 font-body text-caption font-medium uppercase text-ink-muted">
                  {concept.status}
                </p>
                <h2 className="mt-3 font-display text-display-xs font-light italic text-ink">
                  {concept.title}
                </h2>
                {concept.description ? (
                  <p className="mt-4 whitespace-pre-line font-body text-body-s text-ink-secondary">
                    {concept.description}
                  </p>
                ) : null}
                <div className="mt-6 flex flex-col gap-4 border-t border-line pt-5 md:flex-row md:items-center md:justify-between">
                  <form action={selectConceptAction}>
                    <input name="projectId" type="hidden" value={projectId} />
                    <input name="roomId" type="hidden" value={roomId} />
                    <input name="conceptId" type="hidden" value={concept.id} />
                    <Button
                      disabled={concept.status === "selected"}
                      type="submit"
                      variant={concept.status === "selected" ? "secondary" : "primary"}
                    >
                      {concept.status === "selected" ? "Selected" : "Select concept"}
                    </Button>
                  </form>
                </div>
                <div className="mt-6 border-t border-line pt-5">
                  <p className="font-body text-caption font-medium uppercase text-ink-muted">
                    Critique And Revise
                  </p>
                  {(critiquesByConcept.get(concept.id) ?? []).length > 0 ? (
                    <div className="mt-4 space-y-3">
                      {(critiquesByConcept.get(concept.id) ?? []).map((critique) => (
                        <p
                          className="border border-line bg-page px-4 py-3 font-display text-body-s italic text-ink-secondary"
                          key={critique.id}
                        >
                          {critique.critique_text}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  <form action={reviseConceptAction} className="mt-5">
                    <input name="projectId" type="hidden" value={projectId} />
                    <input name="roomId" type="hidden" value={roomId} />
                    <input name="conceptId" type="hidden" value={concept.id} />
                    <Textarea
                      id={`critique-${concept.id}`}
                      label="Designer critique"
                      name="critique"
                      placeholder="make the palette warmer, keep the sofa placement, reduce ornament..."
                    />
                    <Button className="w-full" type="submit" variant="secondary">
                      Generate revision
                    </Button>
                  </form>
                </div>
              </article>
            ))
          ) : (
            <div className="border border-line bg-surface p-8 md:col-span-2">
              <p className="font-display text-display-xs font-light italic text-ink">
                No concepts generated yet.
              </p>
              <p className="mt-4 max-w-[560px] font-body text-body-s text-ink-secondary">
                The first concept uses the uploaded room photo and saved brief. It is an initial
                design direction, not a shopping-list claim.
              </p>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
