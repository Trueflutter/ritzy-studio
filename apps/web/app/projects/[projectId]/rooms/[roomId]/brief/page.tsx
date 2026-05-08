import { visualStyleOptions } from "@ritzy-studio/domain";
import { ButtonLink, SubmitButton, TextInput, Textarea } from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { saveClarifyingAnswersAction, saveDesignBriefAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function DesignBriefPage({
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
    .select("*")
    .eq("room_id", roomId)
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: questions = [] } = designBrief
    ? await supabase
        .from("clarifying_questions")
        .select("*")
        .eq("design_brief_id", designBrief.id)
        .order("created_at", { ascending: true })
    : { data: [] };

  const { data: measurements } = await supabase
    .from("room_measurements")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const answeredCount = (questions ?? []).filter((question) => question.status === "answered").length;
  const selectedStyleSlugs = stringArrayFromStructuredJson(
    designBrief?.structured_json,
    "likedStyleSlugs"
  );
  const avoidedStyleSlugs = stringArrayFromStructuredJson(
    designBrief?.structured_json,
    "avoidedStyleSlugs"
  );

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

      <section className="mx-auto grid max-w-[1120px] gap-12 px-5 py-12 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-12 xl:px-16">
        <div>
          <p className="font-body text-caption font-medium uppercase text-ink-muted">
            Project — Photos — Brief — Generate — Critique — Match
          </p>
          <div className="mt-3 h-px w-32 bg-ink" />

          <p className="mt-12 font-body text-caption font-medium uppercase text-ink-muted">
            N° 04 — Design Brief
          </p>
          <h1 className="mt-6 font-display text-display-l font-light leading-none tracking-[-0.015em] text-ink">
            Define the room before the first concept.
          </h1>
          <p className="mt-6 max-w-[640px] font-body text-body-m text-ink-secondary">
            {project.name} · {room.name} · {room.room_type}
          </p>

          {message ? (
            <p className="mt-8 border border-line bg-surface px-4 py-3 font-display text-body-s italic text-ink-secondary">
              {message}
            </p>
          ) : null}

          <form action={saveDesignBriefAction} className="mt-12">
            <input name="projectId" type="hidden" value={projectId} />
            <input name="roomId" type="hidden" value={roomId} />
            <input name="roomType" type="hidden" value={room.room_type} />

            <section className="mb-12 border border-line bg-surface">
              <div className="border-b border-line p-5">
                <p className="font-body text-caption font-medium uppercase text-ink-muted">
                  Visual Style
                </p>
                <h2 className="mt-4 font-display text-display-s font-light italic text-ink">
                  Choose the rooms that feel closest.
                </h2>
                <p className="mt-4 max-w-[62ch] font-body text-body-s text-ink-secondary">
                  Pick one or more directions. The names are only shortcuts; the images and plain
                  language carry the actual brief.
                </p>
              </div>
              <div className="grid gap-px bg-line md:grid-cols-2 xl:grid-cols-3">
                {visualStyleOptions.map((style) => {
                  const checked = selectedStyleSlugs.includes(style.slug);
                  const avoided = avoidedStyleSlugs.includes(style.slug);

                  return (
                    <article className="bg-surface p-4" key={style.slug}>
                      <label className="group block cursor-pointer">
                        <input
                          className="peer sr-only"
                          defaultChecked={checked}
                          name="styleSlugs"
                          type="checkbox"
                          value={style.slug}
                        />
                        <span className="block border border-line bg-page transition-colors duration-standard ease-standard peer-checked:border-ink peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ring">
                          <span className="relative block aspect-[4/3] overflow-hidden bg-surface-subtle">
                            <Image
                              alt={`${style.name} interior style reference`}
                              className="h-full w-full object-cover transition-transform duration-standard ease-standard group-hover:scale-[1.02]"
                              height={360}
                              unoptimized
                              src={styleImageUrl(style.slug)}
                              width={480}
                            />
                          </span>
                          <span className="block p-4">
                            <span className="font-display text-body-l font-light italic text-ink">
                              {style.name}
                            </span>
                            <span className="mt-2 block font-body text-body-s text-ink-secondary">
                              {style.description}
                            </span>
                            <span className="mt-4 inline-flex font-body text-caption font-medium uppercase text-accent-deep">
                              {checked ? "Selected" : "Select"}
                            </span>
                          </span>
                        </span>
                      </label>
                      <label className="mt-3 flex items-start gap-3 border-t border-line pt-3 font-body text-body-s text-ink-secondary">
                        <input
                          className="mt-1 size-4 accent-[var(--rs-primary)]"
                          defaultChecked={avoided}
                          name="avoidStyleSlugs"
                          type="checkbox"
                          value={style.slug}
                        />
                        Not this direction
                      </label>
                    </article>
                  );
                })}
              </div>
            </section>

            <Textarea
              defaultValue={designBrief?.style_notes ?? ""}
              id="styleNotes"
              label="Style direction"
              name="styleNotes"
              placeholder="quiet contemporary, warm editorial, tailored villa, family-friendly luxury..."
            />
            <Textarea
              defaultValue={designBrief?.color_notes ?? ""}
              id="colorNotes"
              label="Colour preferences"
              name="colorNotes"
              placeholder="bone, olive, walnut, muted ochre; avoid cool grey..."
            />
            <Textarea
              defaultValue={designBrief?.budget_notes ?? ""}
              id="budgetNotes"
              label="Budget range and priorities"
              name="budgetNotes"
              placeholder="AED 35,000 total; invest in sofa and lighting, save on accessories..."
            />
            <Textarea
              defaultValue={designBrief?.functional_requirements ?? ""}
              id="functionalRequirements"
              label="Functional requirements"
              name="functionalRequirements"
              placeholder="seating for six, child-safe finishes, blackout curtains, storage for toys..."
            />
            <Textarea
              defaultValue={designBrief?.avoid_notes ?? ""}
              id="avoidNotes"
              label="Avoid"
              name="avoidNotes"
              placeholder="no glass coffee table, no high-pile rug, avoid visible brass..."
            />
            <Textarea
              defaultValue={designBrief?.inspiration_notes ?? ""}
              id="inspirationNotes"
              label="Inspiration"
              name="inspirationNotes"
              placeholder="hotel lobby in Downtown Dubai, Pinterest references, previous client comments..."
            />

            <div className="mt-10 border-t border-line pt-8">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Measurements
              </p>
              <div className="mt-6 grid gap-x-6 md:grid-cols-3">
                <TextInput
                  defaultValue={measurements?.wall_length_cm ?? ""}
                  id="wallLengthCm"
                  label="Main wall cm"
                  min="1"
                  name="wallLengthCm"
                  placeholder="520"
                  type="number"
                />
                <TextInput
                  defaultValue={measurements?.room_depth_cm ?? ""}
                  id="roomDepthCm"
                  label="Room depth cm"
                  min="1"
                  name="roomDepthCm"
                  placeholder="410"
                  type="number"
                />
                <TextInput
                  defaultValue={measurements?.ceiling_height_cm ?? ""}
                  id="ceilingHeightCm"
                  label="Ceiling cm"
                  min="1"
                  name="ceilingHeightCm"
                  placeholder="290"
                  type="number"
                />
              </div>
              <Textarea
                defaultValue={measurements?.notes ?? ""}
                id="measurementNotes"
                label="Measurement notes"
                name="measurementNotes"
                placeholder="window wall estimated; ceiling height confirmed by contractor..."
              />
            </div>

            <div className="mt-12 flex flex-col gap-4 border-t border-line pt-8 md:flex-row md:items-center md:justify-between">
              <ButtonLink href={`/projects/${projectId}/rooms/${roomId}/photos`} variant="quiet">
                back to photos
              </ButtonLink>
              <div className="flex flex-col gap-4 md:flex-row md:items-center">
                {designBrief ? (
                  <ButtonLink href={`/projects/${projectId}/rooms/${roomId}/concepts`} variant="secondary">
                    open concepts
                  </ButtonLink>
                ) : null}
                <SubmitButton pendingLabel="Saving brief and preparing questions...">
                  Save brief
                </SubmitButton>
              </div>
            </div>
          </form>
        </div>

        <aside className="border border-line bg-surface p-5 lg:sticky lg:top-8 lg:self-start">
          <p className="font-body text-caption font-medium uppercase text-ink-muted">
            Clarifying Questions
          </p>
          <div className="mt-3 h-px w-20 bg-ink" />
          <p className="mt-6 font-display text-display-xs font-light italic text-ink">
            {questions && questions.length > 0
              ? `${answeredCount} of ${questions.length} answered`
              : "The system will ask only what changes the design."}
          </p>

          {questions && questions.length > 0 ? (
            <form action={saveClarifyingAnswersAction} className="mt-8">
              <input name="projectId" type="hidden" value={projectId} />
              <input name="roomId" type="hidden" value={roomId} />
              {questions.map((question, index) => (
                <div className="border-t border-line py-6 first:border-t-0 first:pt-0" key={question.id}>
                  <p className="font-body text-caption font-medium uppercase text-ink-muted">
                    Question {String(index + 1).padStart(2, "0")}
                  </p>
                  <p className="mt-3 font-body text-body-s text-ink">{question.question}</p>
                  <Textarea
                    defaultValue={question.answer ?? ""}
                    id={`answer-${question.id}`}
                    label="Answer"
                    name={`answer:${question.id}`}
                    placeholder="type the designer's decision..."
                  />
                </div>
              ))}
              <SubmitButton className="w-full" pendingLabel="Saving answers..." variant="secondary">
                Save answers
              </SubmitButton>
            </form>
          ) : (
            <div className="mt-8 border-t border-line pt-6">
              <p className="font-body text-body-s text-ink-secondary">
                Submit the brief to generate bounded questions, then answer only the ones that affect
                fit, budget, style, or client approval.
              </p>
            </div>
          )}
        </aside>
      </section>
    </main>
  );
}

function stringArrayFromStructuredJson(value: unknown, key: "likedStyleSlugs" | "avoidedStyleSlugs") {
  if (!value || typeof value !== "object" || !("visualPreferences" in value)) {
    return [];
  }

  const visualPreferences = (value as { visualPreferences?: unknown }).visualPreferences;
  if (!visualPreferences || typeof visualPreferences !== "object" || !(key in visualPreferences)) {
    return [];
  }

  const possibleValues = (visualPreferences as Record<string, unknown>)[key];
  return Array.isArray(possibleValues)
    ? possibleValues.filter((item): item is string => typeof item === "string")
    : [];
}

function styleImageUrl(slug: string) {
  const images: Record<string, string> = {
    "warm-minimal":
      "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?auto=format&fit=crop&w=960&q=80",
    "modern-organic":
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=960&q=80",
    "quiet-luxury":
      "https://images.unsplash.com/photo-1616486338812-3dadae4b4ace?auto=format&fit=crop&w=960&q=80",
    "classic-contemporary":
      "https://images.unsplash.com/photo-1600210492486-724fe5c67fb0?auto=format&fit=crop&w=960&q=80",
    "coastal-light":
      "https://images.unsplash.com/photo-1615874694520-474822394e73?auto=format&fit=crop&w=960&q=80",
    "earthy-rustic":
      "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=960&q=80"
  };

  return images[slug] ?? images["warm-minimal"];
}
