import { z } from "zod";

// The canonical room design spec (S2): extracted from the approved concept by a
// vision pass, confirmed or edited by the user on /spec, and consumed by sourcing
// and rendering as truth. These schemas validate the jsonb columns on
// room_design_specs so a malformed extraction can never reach the database or a
// consumer unnoticed.

// The one set of numbers every spec surface reads: zod schema, extraction
// response, and the /spec form clamps.
export const DESIGN_SPEC_LIMITS = {
  maxObjects: 30,
  labelMax: 120,
  sizeDescriptorMax: 200,
  capacityMax: 120,
  quantityMax: 24,
  paletteEntriesMax: 8,
  paletteEntryMax: 120,
  preserveEntriesMax: 16,
  preserveEntryMax: 200
} as const;

export const designSpecObjectSchema = z.object({
  role: z.string().min(2).max(60),
  label: z.string().min(2).max(DESIGN_SPEC_LIMITS.labelMax),
  quantity: z.number().int().min(1).max(DESIGN_SPEC_LIMITS.quantityMax),
  sizeDescriptor: z.string().min(2).max(DESIGN_SPEC_LIMITS.sizeDescriptorMax).nullable(),
  capacity: z.string().min(2).max(DESIGN_SPEC_LIMITS.capacityMax).nullable(),
  paletteMaterials: z.array(z.string().min(2).max(DESIGN_SPEC_LIMITS.paletteEntryMax)).max(DESIGN_SPEC_LIMITS.paletteEntriesMax)
});

export const designSpecObjectsSchema = z.array(designSpecObjectSchema).min(1).max(DESIGN_SPEC_LIMITS.maxObjects);

export const designSpecMustPreserveSchema = z
  .array(z.string().min(2).max(DESIGN_SPEC_LIMITS.preserveEntryMax))
  .max(DESIGN_SPEC_LIMITS.preserveEntriesMax);

export type DesignSpecObject = z.infer<typeof designSpecObjectSchema>;

export type RoomDesignSpec = {
  id: string;
  roomId: string;
  conceptId: string;
  objects: DesignSpecObject[];
  mustPreserve: string[];
  status: "extracted" | "confirmed";
};

// Parses the jsonb columns of a room_design_specs row. Returns null when the
// stored value does not validate, so consumers fail visibly instead of running
// against a half-shaped spec.
export function parseRoomDesignSpecRow(row: {
  id: string;
  room_id: string;
  concept_id: string;
  objects: unknown;
  must_preserve: unknown;
  status: string;
}): RoomDesignSpec | null {
  const objects = designSpecObjectsSchema.safeParse(row.objects);
  const mustPreserve = designSpecMustPreserveSchema.safeParse(row.must_preserve);
  if (!objects.success || !mustPreserve.success) {
    return null;
  }
  if (row.status !== "extracted" && row.status !== "confirmed") {
    return null;
  }
  return {
    id: row.id,
    roomId: row.room_id,
    conceptId: row.concept_id,
    objects: objects.data,
    mustPreserve: mustPreserve.data,
    status: row.status
  };
}
