import { z } from "zod";

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
  roomType: z.string().min(1),
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
    roomType: z.string().min(1)
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

export const designBriefSchema = z.object({
  projectId: z.uuid(),
  roomId: z.uuid(),
  roomType: z.string().min(1),
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
