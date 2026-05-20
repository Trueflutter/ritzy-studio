import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import { BriefShell } from "../../_components/brief-shell";
import { QuestionAdvanceForm } from "../../_components/question-advance-form";

export const dynamic = "force-dynamic";

export default async function BriefQuestionPage({
  params
}: {
  params: Promise<{ projectId: string; roomId: string; index: string }>;
}) {
  const { projectId, roomId, index } = await params;
  const currentIndex = Number(index);

  if (!Number.isInteger(currentIndex) || currentIndex < 0) {
    notFound();
  }

  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: project } = await supabase.from("projects").select("*").eq("id", projectId).single();
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

  if (!designBrief) {
    redirect(`/projects/${projectId}/rooms/${roomId}/brief/details`);
  }

  const { data: questions = [] } = await supabase
    .from("clarifying_questions")
    .select("*")
    .eq("design_brief_id", designBrief.id)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });

  if (!questions || questions.length === 0) {
    redirect(`/projects/${projectId}/rooms/${roomId}/concepts?autogenerate=1`);
  }

  const question = questions[currentIndex];
  if (!question) {
    redirect(`/projects/${projectId}/rooms/${roomId}/brief/questions/0`);
  }

  const answeredCount = questions.filter((item) => item.status === "answered").length;

  return (
    <BriefShell
      backHref={
        currentIndex > 0
          ? `/projects/${projectId}/rooms/${roomId}/brief/questions/${currentIndex - 1}`
          : `/projects/${projectId}/rooms/${roomId}/brief/details`
      }
      currentStep={4}
      eyebrow="N° 07 — Clarifying Questions"
      projectName={project.name}
      roomName={room.name}
      roomType={room.room_type}
    >
      <QuestionDots answeredCount={answeredCount} currentIndex={currentIndex} total={questions.length} />
      <div className="mt-12">
        <QuestionAdvanceForm
          answer={question.answer ?? ""}
          currentIndex={currentIndex}
          key={question.id}
          projectId={projectId}
          question={question.question}
          questionCount={questions.length}
          questionId={question.id}
          roomId={roomId}
        />
      </div>
    </BriefShell>
  );
}

function QuestionDots({
  answeredCount,
  currentIndex,
  total
}: {
  answeredCount: number;
  currentIndex: number;
  total: number;
}) {
  return (
    <div className="mx-auto flex max-w-[760px] items-center justify-between gap-4">
      <div className="flex flex-1 items-center gap-2">
        {Array.from({ length: total }).map((_, index) => (
          <span
            aria-hidden
            className={
              index === currentIndex
                ? "block h-px flex-1 bg-ink"
                : index < answeredCount
                  ? "block h-px flex-1 bg-accent-deep"
                  : "block h-px flex-1 bg-line-strong"
            }
            key={index}
          />
        ))}
      </div>
      <p className="font-body text-caption font-medium uppercase text-ink-muted">
        {answeredCount} of {total} answered
      </p>
    </div>
  );
}
