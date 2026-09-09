import { z } from "zod";

import { userIntendedModeSchema } from "./entitlements";

export const confidenceLevelSchema = z.enum(["verified", "assumed", "estimated", "unknown"]);

export const projectStatusSchema = z.enum(["draft", "active", "archived"]);

export const roomStatusSchema = z.enum([
  "draft",
  "briefing",
  "concepting",
  "sourcing",
  "rendering",
  "complete"
]);

export const roomCreationRoomTypes = [
  "Living & Dining",
  "Living Room",
  "Dining Room",
  "Bedroom",
  "Home Office"
] as const;

export const canonicalRoomTypes = roomCreationRoomTypes;

export const canonicalRoomTypeSchema = z.enum(canonicalRoomTypes);

export function isCombinedLivingDining(value: string): boolean {
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[/_-]/g, " ")
    .replace(/\s+/g, " ");

  return /\bliving\b/.test(normalized) && /\bdining\b/.test(normalized);
}

export function normalizeRoomType(roomType: string) {
  const normalized = roomType.trim().toLowerCase();

  if (isCombinedLivingDining(roomType)) {
    return "Living & Dining";
  }

  if (
    [
      "living",
      "living room",
      "lounge",
      "family lounge",
      "family room",
      "sitting room",
      "parlour",
      "parlor",
      "salon",
      "majlis"
    ].includes(normalized)
  ) {
    return "Living Room";
  }

  if (["dining", "dining room", "dining area"].includes(normalized)) {
    return "Dining Room";
  }

  if (["bed", "bedroom", "primary bedroom", "master bedroom", "guest bedroom"].includes(normalized)) {
    return "Bedroom";
  }

  if (["office", "home office", "study", "workspace", "work room"].includes(normalized)) {
    return "Home Office";
  }

  return canonicalRoomTypeSchema.parse(roomType);
}

export const createProjectSchema = z.object({
  name: z.string().min(1),
  clientName: z.string().optional(),
  location: z.string().optional(),
  budgetMinAed: z.number().nonnegative().optional(),
  budgetMaxAed: z.number().nonnegative().optional()
});

export const createRoomSchema = z.object({
  projectId: z.uuid(),
  name: z.string().min(1),
  roomType: z.string().min(1).transform(normalizeRoomType),
  notes: z.string().optional()
});

export const createProjectWithRoomSchema = z
  .object({
    name: z.string().min(1),
    clientName: z.string().optional(),
    location: z.string().optional(),
    budgetMinAed: z.number().nonnegative().optional(),
    budgetMaxAed: z.number().nonnegative().optional(),
    roomName: z.string().min(1),
    roomType: z.string().min(1).transform(normalizeRoomType)
  })
  .refine(
    (value) =>
      value.budgetMinAed === undefined ||
      value.budgetMaxAed === undefined ||
      value.budgetMinAed <= value.budgetMaxAed,
    {
      message: "Budget minimum must be less than or equal to budget maximum.",
      path: ["budgetMaxAed"]
    }
  );

export const setUserModeSchema = z.object({
  intendedMode: userIntendedModeSchema
});

// The brief's field bounds, in one place, because the browser and the server
// must enforce the same numbers. The form renders these as `maxLength` and
// `max` so a shopper is stopped before she submits something the schema would
// refuse; the schema below is built from the same table so the two cannot
// drift apart. `brief-field-bounds.test.ts` proves the agreement by exercising
// the schema at each bound rather than trusting the wiring.
export const BRIEF_FIELD_BOUNDS = {
  styleNotes: { kind: "text", max: 2000 },
  colorNotes: { kind: "text", max: 1200 },
  budgetNotes: { kind: "text", max: 1200 },
  functionalRequirements: { kind: "text", max: 2000 },
  avoidNotes: { kind: "text", max: 1200 },
  inspirationNotes: { kind: "text", max: 1600 },
  measurementNotes: { kind: "text", max: 1200 },
  wallLengthCm: { kind: "number", min: 1, max: 5000 },
  roomDepthCm: { kind: "number", min: 1, max: 5000 },
  ceilingHeightCm: { kind: "number", min: 1, max: 1000 }
} as const satisfies Record<string, { kind: "text"; max: number } | { kind: "number"; min: number; max: number }>;

export type BriefFieldName = keyof typeof BRIEF_FIELD_BOUNDS;

const textBound = (field: Extract<BriefFieldName, keyof typeof BRIEF_FIELD_BOUNDS>) =>
  z.string().max(BRIEF_FIELD_BOUNDS[field].max).optional();

export const designBriefSchema = z.object({
  projectId: z.uuid(),
  roomId: z.uuid(),
  roomType: z.string().min(1),
  styleSlugs: z.array(z.string()).default([]),
  avoidStyleSlugs: z.array(z.string()).default([]),
  styleNotes: textBound("styleNotes"),
  colorNotes: textBound("colorNotes"),
  budgetNotes: textBound("budgetNotes"),
  functionalRequirements: textBound("functionalRequirements"),
  avoidNotes: textBound("avoidNotes"),
  inspirationNotes: textBound("inspirationNotes"),
  wallLengthCm: z.number().positive().max(BRIEF_FIELD_BOUNDS.wallLengthCm.max).optional(),
  roomDepthCm: z.number().positive().max(BRIEF_FIELD_BOUNDS.roomDepthCm.max).optional(),
  ceilingHeightCm: z.number().positive().max(BRIEF_FIELD_BOUNDS.ceilingHeightCm.max).optional(),
  measurementNotes: textBound("measurementNotes")
});

export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type CreateProjectWithRoomInput = z.infer<typeof createProjectWithRoomSchema>;
export type DesignBriefInput = z.infer<typeof designBriefSchema>;
export type SetUserModeInput = z.infer<typeof setUserModeSchema>;

export * from "./product-enrichment";
export * from "./product-matching";
export * from "./product-matching-role-keys";
export * from "./anchor-selection";
export * from "./product-matching-dimensions";
export * from "./design-spec";
export * from "./spec-sourcing";
export * from "./measurement-confidence";
export * from "./spatial-design-rules";
export * from "./view-planning";
export * from "./product-matching-evidence";
export * from "./product-matching-freshness";
export * from "./entitlements";
export * from "./style-preferences";
