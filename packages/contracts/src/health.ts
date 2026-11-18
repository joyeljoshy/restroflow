import { z } from "zod";

export const serviceStatusSchema = z.enum(["ok", "degraded"]);

export const healthResponseSchema = z.object({
  status: serviceStatusSchema,
  service: z.literal("restroflow-api"),
  version: z.string().min(1),
  timestamp: z.iso.datetime(),
  checks: z.object({ database: z.enum(["up", "down"]) }),
});

export type HealthResponse = z.infer<typeof healthResponseSchema>;
