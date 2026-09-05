import { SubmitButton } from "@ritzy-studio/ui";

// The reveal's render form (S4). Takes its action as a prop so the markup can
// be server-rendered in a test without the "use server" module: the hidden
// retryOf field is the wire between a review-flagged hero and the action's
// render-again rule, and it must exist exactly when the note offers it.
export type FinalRenderFormAction = (formData: FormData) => void | Promise<void>;

export function FinalRenderForm({
  action,
  canRequestRender,
  conceptId,
  projectId,
  roomId,
  selectedIds,
  shoppingListId,
  retryOf = null,
  tone = "paper"
}: {
  action: FinalRenderFormAction;
  canRequestRender: boolean;
  conceptId: string | null;
  projectId: string;
  roomId: string;
  selectedIds: string[];
  shoppingListId: string | null;
  // The succeeded job this submission renders again (S4): the action accepts it
  // only for a job whose placement review stayed unresolved or could not run.
  retryOf?: string | null;
  tone?: "paper" | "ink";
}) {
  const button = (
    <SubmitButton
      className={tone === "ink" ? "mt-6" : "mt-8"}
      disabled={!canRequestRender || conceptId === null || shoppingListId === null}
      pendingLabel="Generating render..."
      variant={tone === "ink" ? "paper" : undefined}
    >
      {retryOf ? "Render again" : "Generate render"}
    </SubmitButton>
  );

  if (!canRequestRender || conceptId === null || shoppingListId === null) {
    return button;
  }

  return (
    <form action={action}>
      <input name="projectId" type="hidden" value={projectId} />
      <input name="roomId" type="hidden" value={roomId} />
      <input name="conceptId" type="hidden" value={conceptId} />
      <input name="shoppingListId" type="hidden" value={shoppingListId} />
      <input name="selectedItemIds" type="hidden" value={selectedIds.join(",")} />
      {retryOf ? <input name="retryOf" type="hidden" value={retryOf} /> : null}
      {button}
    </form>
  );
}
