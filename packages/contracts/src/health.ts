import { z } from "zod";

export const serviceStatusSchema = z.enum(["ok", "degraded"]);

export const healthResponseSchema = z.object({
  status: serviceStatusSchema,
  service: z.literal("restroflow-api"),
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
  checks: z.object({ database: z.enum(["up", "down"]) }),
});

export const livenessResponseSchema = z.object({
  status: z.literal("ok"),
  service: z.literal("restroflow-api"),
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
export type LivenessResponse = z.infer<typeof livenessResponseSchema>;
