// Decodes the /spec ledger form into the shapes confirmRoomDesignSpec validates.
// Pure and pinned by tests: this is the only ingress for user edits into the
// confirmed spec that sourcing, swaps, and rendering consume as truth.
//
// Coercion policy (review direction): free-list fields (palette materials,
// must-preserve lines) are cleaned server-side — sub-2-char entries dropped,
// over-long entries truncated, counts capped — so a stray comma can never void a
// whole submit. Row-level fields (label, quantity) fail with a message naming
// the row, because silently repairing them would change what the user said.

const MAX_OBJECTS = 30;
const MAX_PALETTE_ENTRIES = 8;
const MAX_PALETTE_LENGTH = 120;
const MAX_PRESERVE_ENTRIES = 16;
const MAX_PRESERVE_LENGTH = 200;

export type SpecLedgerObject = {
  role: string;
  label: string;
  quantity: number;
  sizeDescriptor: string | null;
  capacity: string | null;
  paletteMaterials: string[];
};

export type SpecLedgerParseResult =
  | { ok: true; objects: SpecLedgerObject[]; mustPreserve: string[] }
  | { ok: false; message: string };

function cleanedList(raw: string, separator: RegExp, maxEntries: number, maxLength: number) {
  return raw
    .split(separator)
    .map((entry) => entry.trim().slice(0, maxLength))
    .filter((entry) => entry.length >= 2)
    .slice(0, maxEntries);
}

function optionalField(value: string) {
  const trimmed = value.trim();
  return trimmed.length >= 2 ? trimmed : null;
}

export function parseSpecLedgerForm(formData: FormData): SpecLedgerParseResult {
  const objectCount = Math.min(Number(formData.get("objectCount")) || 0, MAX_OBJECTS);
  const objects: SpecLedgerObject[] = [];

  for (let index = 0; index < objectCount; index += 1) {
    if (formData.get(`object-${index}-remove`) === "on") {
      continue;
    }
    const labelField = formData.get(`object-${index}-label`);
    if (labelField === null) {
      // Absent row (count larger than the posted rows): skip, never fail.
      continue;
    }
    const label = String(labelField).trim();
    if (label.length < 2) {
      return { ok: false, message: `Piece ${index + 1} needs a name (at least two characters).` };
    }
    const quantity = Number(formData.get(`object-${index}-quantity`) ?? 0);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 24) {
      return { ok: false, message: `"${label}" needs a quantity between 1 and 24.` };
    }
    objects.push({
      role: String(formData.get(`object-${index}-role`) ?? "").trim(),
      label: label.slice(0, 120),
      quantity,
      sizeDescriptor: optionalField(
        String(formData.get(`object-${index}-sizeDescriptor`) ?? "").slice(0, 200)
      ),
      capacity: optionalField(String(formData.get(`object-${index}-capacity`) ?? "").slice(0, 120)),
      paletteMaterials: cleanedList(
        String(formData.get(`object-${index}-paletteMaterials`) ?? ""),
        /,/,
        MAX_PALETTE_ENTRIES,
        MAX_PALETTE_LENGTH
      )
    });
  }

  if (objects.length === 0) {
    return { ok: false, message: "Keep at least one piece; a spec with nothing in it cannot be sourced." };
  }

  const mustPreserve = cleanedList(
    String(formData.get("mustPreserve") ?? ""),
    /\n/,
    MAX_PRESERVE_ENTRIES,
    MAX_PRESERVE_LENGTH
  );

  return { ok: true, objects, mustPreserve };
}
