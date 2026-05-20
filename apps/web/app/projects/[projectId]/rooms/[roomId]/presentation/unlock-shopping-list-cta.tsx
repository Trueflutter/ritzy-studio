"use client";

import { Button, SubmitButton } from "@ritzy-studio/ui";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { createHomeownerRoomUnlockCheckoutAction } from "@/app/actions";

type UnlockShoppingListCtaProps = {
  projectId: string;
  roomId: string;
  returnTo: string;
};

export function UnlockShoppingListCta({
  projectId,
  roomId,
  returnTo
}: UnlockShoppingListCtaProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <Button onClick={() => setOpen(true)} type="button">
        Generate shopping list
      </Button>

      {open && typeof document !== "undefined"
        ? createPortal(
            <div className="fixed inset-0 z-50" role="presentation">
              <button
                aria-label="Close payment confirmation"
                className="absolute inset-0 bg-[rgba(31,31,29,0.46)] backdrop-blur-[10px]"
                onClick={() => setOpen(false)}
                type="button"
              />
              <div
                aria-labelledby="shopping-list-confirm-title"
                aria-modal="true"
                className="absolute inset-0 flex items-center justify-center px-4 py-6"
                role="dialog"
              >
                <section className="w-full max-w-[520px] border border-line bg-surface p-6 shadow-[0_18px_70px_rgba(0,0,0,0.18)] md:p-8">
                  <p className="font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted">
                    Final shopping list
                  </p>
                  <h2
                    className="mt-4 font-display text-display-xs font-light italic text-ink"
                    id="shopping-list-confirm-title"
                  >
                    Generate the final shopping list for AED 500?
                  </h2>
                  <p className="mt-4 font-body text-body-s text-ink-secondary">
                    This opens the full shopping list with retailer links, product details, and
                    eligible partner discounts for this room.
                  </p>
                  <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-end">
                    <Button onClick={() => setOpen(false)} type="button" variant="secondary">
                      Not yet
                    </Button>
                    <form action={createHomeownerRoomUnlockCheckoutAction}>
                      <input name="projectId" type="hidden" value={projectId} />
                      <input name="roomId" type="hidden" value={roomId} />
                      <input name="returnTo" type="hidden" value={returnTo} />
                      <SubmitButton
                        className="w-full sm:w-auto"
                        pendingLabel="Opening secure checkout..."
                      >
                        Proceed
                      </SubmitButton>
                    </form>
                  </div>
                </section>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
