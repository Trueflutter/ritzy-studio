"use client";

import { useFormStatus } from "react-dom";
import { AnimatedStatus } from "@ritzy-studio/ui";

import { GENERATION_OVERFLOW_LINE, GENERATION_PROGRESS_PHASES } from "./concept-generation-panel";

// Design system 12.2: the same verbatim progress copy cycles while a revision
// generates. Rendered inside the revise form so useFormStatus sees its pending
// state; nothing shows when idle.

export function RevisionProgress() {
  const { pending } = useFormStatus();

  if (!pending) {
    return null;
  }

  return <AnimatedStatus className="mt-4" overflowText={GENERATION_OVERFLOW_LINE} phases={GENERATION_PROGRESS_PHASES} />;
}
