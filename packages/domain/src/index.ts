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

export const canonicalRoomTypes = ["Living Room", "Dining Room", "Bedroom", "Home Office"] as const;

export const canonicalRoomTypeSchema = z.enum(canonicalRoomTypes);

export function normalizeRoomType(roomType: string) {
  const normalized = roomType.trim().toLowerCase();

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

export const createHomeownerRoomSchema = z
  .object({
    roomName: z.string().min(1),
    roomType: z.string().min(1).transform(normalizeRoomType),
    location: z.string().optional(),
    budgetMaxAed: z.number().nonnegative().optional()
  })
  .transform((value) => ({
    ...value,
    projectName: `${value.roomName} redesign`
  }));

export const designBriefSchema = z.object({
  projectId: z.uuid(),
  roomId: z.uuid(),
  roomType: z.string().min(1),
  styleSlugs: z.array(z.string()).default([]),
  avoidStyleSlugs: z.array(z.string()).default([]),
  styleNotes: z.string().max(2000).optional(),
  colorNotes: z.string().max(1200).optional(),
  budgetNotes: z.string().max(1200).optional(),
  functionalRequirements: z.string().max(2000).optional(),
  avoidNotes: z.string().max(1200).optional(),
  inspirationNotes: z.string().max(1600).optional(),
  wallLengthCm: z.number().positive().max(5000).optional(),
  roomDepthCm: z.number().positive().max(5000).optional(),
  ceilingHeightCm: z.number().positive().max(1000).optional(),
  measurementNotes: z.string().max(1200).optional()
});

export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
export type CreateProjectWithRoomInput = z.infer<typeof createProjectWithRoomSchema>;
export type DesignBriefInput = z.infer<typeof designBriefSchema>;
export type SetUserModeInput = z.infer<typeof setUserModeSchema>;
export type CreateHomeownerRoomInput = z.infer<typeof createHomeownerRoomSchema>;

export * from "./product-enrichment";
export * from "./product-matching";
export * from "./catalog-first-room-generation";
export * from "./catalog-first-product-matching";
export * from "./product-matching-confidence";
export * from "./measurement-intelligence";
export * from "./product-matching-dimensions";
export * from "./product-matching-evidence";
export * from "./product-matching-freshness";
export * from "./product-matching-pool-quality";
export * from "./measurement-layout-seed";
export * from "./entitlements";
export * from "./style-preferences";
