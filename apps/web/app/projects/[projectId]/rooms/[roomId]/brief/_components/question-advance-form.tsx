"use client";

import { SubmitButton } from "@ritzy-studio/ui";
import { useRef } from "react";

import { saveClarifyingQuestionAction } from "@/app/actions";

export function QuestionAdvanceForm({
  answer,
  currentIndex,
  projectId,
  question,
  questionCount,
  questionId,
  roomId
}: {
  answer: string;
  currentIndex: number;
  projectId: string;
  question: string;
  questionCount: number;
  questionId: string;
  roomId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputName = "answer";

  return (
    <form action={saveClarifyingQuestionAction} className="mx-auto max-w-[760px]" ref={formRef}>
      <input name="projectId" type="hidden" value={projectId} />
      <input name="roomId" type="hidden" value={roomId} />
      <input name="questionId" type="hidden" value={questionId} />
      <input name="currentIndex" type="hidden" value={currentIndex} />
      <input name="questionCount" type="hidden" value={questionCount} />

      <p className="font-body text-caption font-medium uppercase text-ink-muted">
        Question {String(currentIndex + 1).padStart(2, "0")} of {questionCount}
      </p>
      <h1 className="mt-8 font-display text-display-s font-light italic leading-tight text-ink">
        {question}
      </h1>
      <textarea
        autoFocus
        className="mt-10 min-h-32 w-full resize-y border-0 border-b border-line-strong bg-transparent px-0 pb-5 font-display text-display-xs font-light italic text-ink outline-none transition-colors duration-micro ease-standard placeholder:text-ink-disabled focus:border-accent-deep"
        defaultValue={answer}
        name={inputName}
        onKeyDown={(event) => {
          if (event.key !== "Enter") {
            return;
          }

          if (event.metaKey || event.ctrlKey) {
            event.preventDefault();
            formRef.current?.requestSubmit();
          }
        }}
        placeholder="Type your answer here..."
      />

      <div className="mt-8 flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
        <p className="font-body text-caption font-medium uppercase text-ink-muted">
          Press Cmd+Enter to continue
        </p>
        <div className="flex items-center gap-6">
          <button
            className="font-display text-body-s italic text-ink-muted transition-colors duration-micro hover:text-ink"
            name="skip"
            type="submit"
            value="1"
          >
            Skip
          </button>
          <SubmitButton pendingLabel={currentIndex + 1 >= questionCount ? "Starting concept..." : "Saving..."}>
            Continue →
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
