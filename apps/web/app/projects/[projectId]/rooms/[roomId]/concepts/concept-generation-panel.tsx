"use client";

import { useEffect, useRef } from "react";
import { SubmitButton } from "@ritzy-studio/ui";

import { generateInitialConceptAction } from "@/app/actions";

const progressLabels = [
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
    if (autoGenerate && canGenerate) {
      formRef.current?.requestSubmit();
    }
  }, [autoGenerate, canGenerate]);

  return (
    <form action={generateInitialConceptAction} className="mt-8" ref={formRef}>
      <input name="projectId" type="hidden" value={projectId} />
      <input name="roomId" type="hidden" value={roomId} />
      <div className="overflow-hidden border border-line bg-surface">
        <div className="relative flex min-h-[360px] items-center justify-center px-8 py-12">
          <div className="generation-orbit" aria-hidden="true">
            <span />
            <span />
            <span />
          </div>
          <div className="relative z-[1] max-w-[520px] text-center">
            <p className="font-body text-caption font-medium uppercase tracking-[0.18em] text-ink-muted">
              Generation studio
            </p>
            <h2 className="mt-6 font-display text-display-s font-light italic text-ink">
              Building the first room direction.
            </h2>
            <div className="mt-8 grid gap-3 text-left sm:grid-cols-2">
              {progressLabels.map((label, index) => (
                <p
                  className="generation-step border border-line bg-page px-4 py-3 font-body text-caption font-medium uppercase text-ink-muted"
                  key={label}
                  style={{ animationDelay: `${index * 420}ms` }}
                >
                  {label}
                </p>
              ))}
            </div>
            <SubmitButton
              className="mt-8 w-full"
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
