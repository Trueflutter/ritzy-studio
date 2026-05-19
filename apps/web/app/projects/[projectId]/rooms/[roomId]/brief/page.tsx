import { visualStyleOptions } from "@ritzy-studio/domain";
import { ButtonLink, SubmitButton, TextInput, Textarea } from "@ritzy-studio/ui";
import Image from "next/image";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { saveDesignBriefAction } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import { InspirationUploader } from "./inspiration-uploader";
import { VisualStyleSelector } from "./visual-style-selector";

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
  const { data: inspirationAssets = [] } = await supabase
    .from("room_assets")
    .select("*")
    .eq("room_id", roomId)
    .eq("asset_type", "inspiration_image")
    .order("created_at", { ascending: true });
  const signedInspirationAssets = await Promise.all(
    (inspirationAssets ?? []).map(async (asset) => {
      const { data } = await supabase.storage
        .from("room-assets")
        .createSignedUrl(asset.storage_path, 60 * 60);

      return {
        ...asset,
        signedUrl: data?.signedUrl ?? null
      };
    })
  );

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
        <ButtonLink href="/" leading="←" variant="chrome">
          Back to studio
        </ButtonLink>
      </header>

      <form action={saveDesignBriefAction} className="mx-auto grid max-w-[1120px] gap-12 px-5 py-12 md:px-8 lg:grid-cols-[minmax(0,1fr)_360px] lg:px-12 xl:px-16">
        <input name="projectId" type="hidden" value={projectId} />
        <input name="roomId" type="hidden" value={roomId} />
        <input name="roomType" type="hidden" value={room.room_type} />
        <input name="existingQuestionCount" type="hidden" value={(questions ?? []).length} />
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

          <div className="mt-12">
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
              <VisualStyleSelector
                avoidedStyleSlugs={avoidedStyleSlugs}
                selectedStyleSlugs={selectedStyleSlugs}
                styles={visualStyleOptions}
              />
            </section>

            <section className="mb-12 border border-line bg-surface p-5">
              <p className="font-body text-caption font-medium uppercase text-ink-muted">
                Inspiration images
              </p>
              <h2 className="mt-4 font-display text-display-s font-light italic text-ink">
                Add rooms, palettes, or details you already like.
              </h2>
              <p className="mt-4 max-w-[62ch] font-body text-body-s text-ink-secondary">
                These references help the system infer colour, material, and mood before it asks
                follow-up questions.
              </p>
              <div className="mt-6">
                <InspirationUploader
                  existingCount={signedInspirationAssets.length}
                  roomId={roomId}
                  userId={user.id}
                />
              </div>
              {signedInspirationAssets.length > 0 ? (
                <div className="mt-6 grid grid-cols-3 gap-3">
                  {signedInspirationAssets.map((asset, index) => (
                    <figure className="border border-line bg-page p-2" key={asset.id}>
                      <div className="flex aspect-square items-center justify-center bg-surface-subtle">
                        {asset.signedUrl ? (
                          <Image
                            alt={`Inspiration reference ${index + 1}`}
                            className="h-full w-full object-cover"
                            height={180}
                            unoptimized
                            src={asset.signedUrl}
                            width={180}
                          />
                        ) : (
                          <p className="font-display text-body-s italic text-error">missing</p>
                        )}
                      </div>
                    </figure>
                  ))}
                </div>
              ) : null}
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
              placeholder="Tell us the colours you want, and anything to avoid..."
            />
            <input
              name="budgetNotes"
              type="hidden"
              value={project.budget_max_aed ? `AED ${Number(project.budget_max_aed).toLocaleString("en-AE")} maximum` : ""}
            />
            {project.budget_min_aed || project.budget_max_aed ? (
              <div className="mb-9 border border-line bg-surface px-5 py-4">
                <p className="font-body text-caption font-medium uppercase text-ink-muted">
                  Budget
                </p>
                <p className="mt-2 font-body text-body-m text-ink">
                  {formatBudget(project.budget_min_aed, project.budget_max_aed)}
                </p>
              </div>
            ) : null}
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
              <ButtonLink href={`/projects/${projectId}/rooms/${roomId}/photos`} leading="←" variant="chrome">
                Back to photos
              </ButtonLink>
              <SubmitButton pendingLabel={(questions ?? []).length > 0 ? "Starting concept generation..." : "Preparing questions..."}>
                Next
              </SubmitButton>
            </div>
          </div>
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
            <div className="mt-8">
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
              <p className="border-t border-line pt-6 font-body text-body-s text-ink-secondary">
                The Next button saves these answers and starts concept generation.
              </p>
            </div>
          ) : (
            <div className="mt-8 border-t border-line pt-6">
              <p className="font-body text-body-s text-ink-secondary">
                Submit the brief to generate bounded questions, then answer only the ones that affect
                fit, budget, style, or client approval.
              </p>
            </div>
          )}
        </aside>
      </form>
    </main>
  );
}

function formatBudget(min: number | null, max: number | null) {
  if (min && max) {
    return `AED ${Number(min).toLocaleString("en-AE")} to AED ${Number(max).toLocaleString("en-AE")}`;
  }

  if (max) {
    return `Up to AED ${Number(max).toLocaleString("en-AE")}`;
  }

  return `From AED ${Number(min).toLocaleString("en-AE")}`;
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
