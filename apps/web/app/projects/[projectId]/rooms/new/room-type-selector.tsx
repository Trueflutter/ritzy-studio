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
              required
              type="radio"
              value={roomType}
            />
            <span className="block font-display text-display-xs font-light italic text-ink">
              {roomType}
            </span>
            <span className="pointer-events-none absolute inset-0 border border-transparent transition-colors duration-micro ease-standard peer-checked:border-ink" />
          </label>
        ))}
      </div>
    </fieldset>
  );
}
