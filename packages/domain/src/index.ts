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

export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;
export type ProjectStatus = z.infer<typeof projectStatusSchema>;
export type RoomStatus = z.infer<typeof roomStatusSchema>;
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type CreateRoomInput = z.infer<typeof createRoomSchema>;
