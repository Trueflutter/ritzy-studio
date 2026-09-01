import { SubmitButton } from "@ritzy-studio/ui";
import type { DesignSpecObject } from "@ritzy-studio/domain";

import { confirmDesignSpecAction } from "@/app/actions";

// The spec ledger (1c pattern): one hairline-divided row per committed object,
// every answer field a white chip on the beige page. Server component; the form
// posts to confirmDesignSpecAction.

const chipClass =
  "w-full border border-line bg-surface px-3 py-2 font-body text-body-s text-ink focus:border-ink focus:outline-none";

export function SpecLedgerForm({
  conceptTitle,
  extracted,
  mustPreserve,
  objects,
  projectId,
  roomId,
  specId
}: {
  conceptTitle: string;
  extracted: boolean;
  mustPreserve: string[];
  objects: DesignSpecObject[];
  projectId: string;
  roomId: string;
  specId: string;
}) {
  return (
    <form action={confirmDesignSpecAction} className="mt-8">
      <input name="projectId" type="hidden" value={projectId} />
      <input name="roomId" type="hidden" value={roomId} />
      <input name="specId" type="hidden" value={specId} />
      <input name="objectCount" type="hidden" value={objects.length} />

      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-display-xs font-light italic text-ink">
          {conceptTitle} — {objects.length} {objects.length === 1 ? "piece" : "pieces"}
        </h2>
        {extracted ? (
          <p className="font-display text-body-s italic text-ink-muted">
            read from the concept — confirm or adjust below
          </p>
        ) : null}
      </div>

      <div className="mt-5 border border-line bg-[#FBF8F2]">
        <div className="hidden grid-cols-[1.3fr_84px_1.2fr_1fr_1.2fr_72px] gap-3 border-b border-line px-4 py-3 md:grid">
          {["Piece", "Qty", "Size", "Seats / holds", "Colours & materials", "Remove"].map((heading) => (
            <p
              className="font-body text-caption font-medium uppercase tracking-[0.24em] text-ink-muted"
              key={heading}
            >
              {heading}
            </p>
          ))}
        </div>

        {objects.map((object, index) => (
          <div
            className="grid grid-cols-1 gap-3 border-t border-line px-4 py-4 first:border-t-0 md:grid-cols-[1.3fr_84px_1.2fr_1fr_1.2fr_72px] md:items-start"
            key={`${object.role}-${index}`}
          >
            <input name={`object-${index}-role`} type="hidden" value={object.role} />
            <div>
              <input
                aria-label={`Piece ${index + 1} name`}
                className={chipClass}
                defaultValue={object.label}
                maxLength={120}
                minLength={2}
                name={`object-${index}-label`}
                required
                type="text"
              />
            </div>
            <div>
              <input
                aria-label={`Piece ${index + 1} quantity`}
                className={chipClass}
                defaultValue={object.quantity}
                inputMode="numeric"
                max={24}
                min={1}
                name={`object-${index}-quantity`}
                required
                type="number"
              />
            </div>
            <div>
              <input
                aria-label={`Piece ${index + 1} size`}
                className={chipClass}
                defaultValue={object.sizeDescriptor ?? ""}
                maxLength={200}
                name={`object-${index}-sizeDescriptor`}
                placeholder="size, in plain words"
                type="text"
              />
              {extracted && object.sizeDescriptor ? (
                <p className="mt-1 font-display text-[13px] italic text-ink-muted">assumed</p>
              ) : null}
            </div>
            <div>
              <input
                aria-label={`Piece ${index + 1} capacity`}
                className={chipClass}
                defaultValue={object.capacity ?? ""}
                maxLength={120}
                name={`object-${index}-capacity`}
                placeholder="e.g. seats 6"
                type="text"
              />
            </div>
            <div>
              <input
                aria-label={`Piece ${index + 1} colours and materials`}
                className={chipClass}
                defaultValue={object.paletteMaterials.join(", ")}
                name={`object-${index}-paletteMaterials`}
                placeholder="comma separated"
                type="text"
              />
            </div>
            <label className="flex items-center gap-2 pt-2 font-body text-body-s text-ink-muted md:justify-center md:pt-0">
              <input className="h-4 w-4 accent-ink" name={`object-${index}-remove`} type="checkbox" />
              <span className="md:hidden">Remove this piece</span>
            </label>
          </div>
        ))}
      </div>

      <div className="mt-8">
        <label
          className="mb-3 block font-body text-caption font-medium uppercase tracking-[0.32em] text-ink-muted"
          htmlFor="mustPreserve"
        >
          Never change these
        </label>
        <p className="-mt-1 mb-3 font-body text-body-s text-ink-muted">
          The architecture and features every render must keep. One per line.
        </p>
        <textarea
          className={`${chipClass} min-h-[120px] leading-relaxed`}
          defaultValue={mustPreserve.join("\n")}
          id="mustPreserve"
          name="mustPreserve"
        />
      </div>

      <div className="mt-10 bg-ink px-6 py-8 text-center md:px-10">
        <p className="font-display text-display-xs font-light italic text-paper">
          Source the room to <em>this exact list.</em>
        </p>
        <p className="mx-auto mt-2 max-w-[460px] font-body text-body-s text-paper/70">
          Sourcing matches real catalog pieces to each row. You can swap pieces later; the list here
          stays the record of what the design asks for.
        </p>
        <SubmitButton className="mt-6 min-w-[260px]" pendingLabel="Confirming...">
          Confirm and source
        </SubmitButton>
      </div>
    </form>
  );
}
