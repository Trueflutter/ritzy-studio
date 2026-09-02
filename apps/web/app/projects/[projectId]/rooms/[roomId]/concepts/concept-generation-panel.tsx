"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { AnimatedStatus, SubmitButton } from "@ritzy-studio/ui";

import { generateInitialConceptAction } from "@/app/actions";
import { RenderExpectationNote } from "../render-expectation-note";

// Design system 12.2: progress copy used verbatim, cycled in order, with the
// overflow line appended after 30 seconds. Do not improvise alternative copy.
export const GENERATION_PROGRESS_PHASES = [
  "preparing the canvas",
  "shaping the room",
  "considering proportions",
  "matching to brief",
  "almost ready"
];

export const GENERATION_OVERFLOW_LINE =
  "this is taking longer than usual — feel free to wait or revise the brief.";

function GenerateConceptSubmit({ autoGenerate, canGenerate }: { autoGenerate: boolean; canGenerate: boolean }) {
  const { pending } = useFormStatus();

  if (autoGenerate || pending) {
    return null;
  }

  return (
    <SubmitButton
      className="mt-10 w-full"
      disabled={!canGenerate}
      pendingLabel="Generating concept..."
    >
      Generate concept
    </SubmitButton>
  );
}

export function ConceptGenerationPanel({
  autoGenerate,
  canGenerate,
  projectId,
  roomId
}: {
  autoGenerate: boolean;
  canGenerate: boolean;
  projectId: string;
  roomId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!autoGenerate || !canGenerate) {
      return;
    }

    const submissionKey = `ritzy:concept-autogenerate:${roomId}`;
    if (window.sessionStorage.getItem(submissionKey)) {
      return;
    }

    window.sessionStorage.setItem(submissionKey, "1");
    formRef.current?.requestSubmit();
  }, [autoGenerate, canGenerate, roomId]);

  return (
    <form action={generateInitialConceptAction} className="mt-8" ref={formRef}>
      <input name="projectId" type="hidden" value={projectId} />
      <input name="roomId" type="hidden" value={roomId} />
      <div className="overflow-hidden border border-line bg-surface">
        <div className="flex min-h-[360px] flex-col items-center justify-center px-8 py-12">
          <div className="max-w-[520px] text-center">
            <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
              Generation studio
            </p>
            <h2 className="mt-6 font-display text-display-s font-light italic text-ink">
              Building the first room direction.
            </h2>
            <RenderExpectationNote className="mx-auto mt-5 max-w-[360px]" />
            <AnimatedStatus className="mt-8" overflowText={GENERATION_OVERFLOW_LINE} phases={GENERATION_PROGRESS_PHASES} />
            <GenerateConceptSubmit autoGenerate={autoGenerate} canGenerate={canGenerate} />
          </div>
        </div>
      </div>
    </form>
  );
}
