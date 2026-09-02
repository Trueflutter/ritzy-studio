"use client";

import { useEffect, useRef, useState } from "react";
import { SubmitButton } from "@ritzy-studio/ui";

// Blocks the one server-reachable refusal (removing every row) at the client, so
// the redirect-and-lose-edits path cannot fire from the UI: the submit disables
// with an inline note while all rows are checked for removal.

export function ConfirmSpecSubmit() {
  const marker = useRef<HTMLDivElement>(null);
  const [allRemoved, setAllRemoved] = useState(false);

  useEffect(() => {
    const form = marker.current?.closest("form");
    if (!form) {
      return;
    }
    const update = () => {
      const removes = form.querySelectorAll<HTMLInputElement>('input[type="checkbox"][name$="-remove"]');
      setAllRemoved(removes.length > 0 && [...removes].every((box) => box.checked));
    };
    update();
    form.addEventListener("change", update);
    return () => form.removeEventListener("change", update);
  }, []);

  return (
    <div ref={marker}>
      {allRemoved ? (
        <p className="mx-auto mt-4 max-w-[420px] font-display text-body-s italic text-paper/80">
          Keep at least one piece; a spec with nothing in it cannot be sourced.
        </p>
      ) : null}
      <SubmitButton className="mt-6 min-w-[260px]" disabled={allRemoved} pendingLabel="Confirming...">
        Confirm and source
      </SubmitButton>
    </div>
  );
}
