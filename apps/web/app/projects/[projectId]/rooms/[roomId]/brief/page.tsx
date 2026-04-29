import { Button, ButtonLink, TextInput, Textarea } from "@ritzy-studio/ui";
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
              <Button type="submit">Generate concepts</Button>
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
              <Button className="w-full" type="submit" variant="secondary">
                Save answers
              </Button>
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
