"use client";

import { useEffect, useRef } from "react";
import { AnimatedStatus, SubmitButton } from "@ritzy-studio/ui";

import { generateInitialConceptAction } from "@/app/actions";

const generationPhases = [
  "Reading the room photo",
  "Studying the brief",
  "Extracting style cues",
  "Refining colour direction",
  "Composing the first layout",
  "Preparing the concept render"
];

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
            <AnimatedStatus className="mt-10" phases={generationPhases} />
            <SubmitButton
              className="mt-10 w-full"
              disabled={!canGenerate}
              pendingLabel="Generating concept..."
            >
              {autoGenerate ? "Generating concept..." : "Generate concept"}
            </SubmitButton>
          </div>
        </div>
      </div>
    </form>
  );
}
