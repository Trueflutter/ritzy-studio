"use client";

import { SubmitButton } from "@ritzy-studio/ui";
import { useEffect, useRef } from "react";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Focus the answer field without scrolling — autoFocus would jump the page
  // on every new question.
  useEffect(() => {
    textareaRef.current?.focus({ preventScroll: true });
  }, []);

  return (
    <form action={saveClarifyingQuestionAction} className="mx-auto max-w-[760px]" ref={formRef}>
      <input name="projectId" type="hidden" value={projectId} />
      <input name="roomId" type="hidden" value={roomId} />
      <input name="questionId" type="hidden" value={questionId} />
      <input name="currentIndex" type="hidden" value={currentIndex} />
      <input name="questionCount" type="hidden" value={questionCount} />

      <div className="border border-line bg-surface p-5">
        <label className="block font-body text-body-l text-ink" htmlFor="answer">
          {question}
        </label>
        <textarea
          className="mt-4 block min-h-[88px] w-full resize-y border-0 bg-transparent p-0 font-body text-body-m text-ink outline-none placeholder:text-[var(--rs-text-placeholder)]"
          defaultValue={answer}
          id="answer"
          name="answer"
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              formRef.current?.requestSubmit();
            }
          }}
          placeholder="Type your answer..."
          ref={textareaRef}
        />
      </div>

      <div className="mt-6 flex flex-col gap-4 border-t border-line pt-6 md:flex-row md:items-center md:justify-between">
        <p className="font-body text-caption font-medium uppercase text-ink-muted">
          Press Enter to continue — answers save as you go
        </p>
        <div className="flex items-center gap-6">
          <button
            className="font-body text-body-s text-ink-muted transition-colors duration-micro hover:text-ink"
            name="skip"
            type="submit"
            value="1"
          >
            Skip
          </button>
          <SubmitButton
            pendingLabel={currentIndex + 1 >= questionCount ? "Starting concept..." : "Saving..."}
          >
            Continue →
          </SubmitButton>
        </div>
      </div>
    </form>
  );
}
