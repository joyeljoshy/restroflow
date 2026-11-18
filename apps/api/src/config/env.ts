import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace", "silent"])
    .default("info"),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000")
    .transform((value) =>
      value
        .split(",")
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(168).default(12),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().max(100).default(5),
  MENU_IMAGE_DIRECTORY: z.string().trim().min(1).default("uploads/menu"),
});

export type Environment = z.infer<typeof envSchema>;

export function loadEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): Environment {
  const parsed = envSchema.safeParse(source);

  if (!parsed.success) {
    console.error(
      "Invalid environment configuration",
      z.flattenError(parsed.error).fieldErrors,
    );
    throw new Error("Invalid environment configuration");
  }

  return parsed.data;
}
