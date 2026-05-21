"use client";

type RoomTypeSelectorProps = {
  roomTypes: readonly string[];
};

export function RoomTypeSelector({ roomTypes }: RoomTypeSelectorProps) {
  return (
    <fieldset className="mb-9">
      <legend>
        <span className="mb-[14px] block font-body text-caption font-medium uppercase text-ink-muted">
          Room type
        </span>
      </legend>
      <div className="grid gap-3 sm:grid-cols-2">
        {roomTypes.map((roomType) => (
          <label
            className="group relative block cursor-pointer border border-line bg-surface p-5 transition-colors duration-micro ease-standard hover:border-ink"
            key={roomType}
          >
            <input
              className="peer sr-only"
              name="roomType"
              onChange={(event) => {
                const form = event.currentTarget.form;

                if (!form) {
                  return;
                }

                if (form.checkValidity()) {
                  form.requestSubmit();
                } else {
                  form.reportValidity();
                }
              }}
              required
              type="radio"
              value={roomType}
            />
            <span className="block font-display text-display-xs font-light italic text-ink">
              {roomType}
            </span>
            <span className="mt-3 block font-body text-caption uppercase tracking-[0.24em] text-ink-muted">
              Select room
            </span>
            <span className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-micro ease-standard peer-checked:border-ink" />
          </label>
        ))}
      </div>
      <p className="mt-3 font-display text-body-s italic text-ink-muted">
        We use this to choose the right design blueprint and sourcing logic.
      </p>
    </fieldset>
  );
}
