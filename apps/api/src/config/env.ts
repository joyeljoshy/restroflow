import { z } from "zod";

import { classifyDatabaseTarget } from "./database-target.js";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  PORT: z.coerce.number().int().positive().max(65_535).default(4000),
  HOST: z.string().trim().min(1).default("0.0.0.0"),
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
  PUBLIC_WEB_ORIGIN: z.url().default("http://localhost:3000"),
  DATABASE_URL: z.string().url().startsWith("postgresql://"),
  SESSION_TTL_HOURS: z.coerce.number().int().positive().max(168).default(12),
  LOGIN_RATE_LIMIT_MAX: z.coerce.number().int().positive().max(100).default(5),
  COOKIE_SAME_SITE: z.enum(["lax", "none"]).default("lax"),
  TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(0),
  IMAGE_STORAGE_PROVIDER: z.enum(["local", "cloudinary"]).default("local"),
  MENU_IMAGE_DIRECTORY: z.string().trim().min(1).default("uploads/menu"),
  CLOUDINARY_CLOUD_NAME: z.string().trim().min(1).optional(),
  CLOUDINARY_API_KEY: z.string().trim().min(1).optional(),
  CLOUDINARY_API_SECRET: z.string().trim().min(1).optional(),
  CLOUDINARY_FOLDER: z.string().trim().min(1).default("restroflow/menu"),
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

  const env = parsed.data;
  const productionErrors: Record<string, string[]> = {};
  if (
    env.NODE_ENV !== "production" &&
    classifyDatabaseTarget(env.DATABASE_URL) !== "LOCAL_LOOPBACK"
  ) {
    productionErrors.DATABASE_URL = [
      "Non-production API startup requires a valid loopback PostgreSQL target.",
    ];
  }
  for (const origin of env.CORS_ORIGINS) {
    try {
      const url = new URL(origin);
      if (
        !["http:", "https:"].includes(url.protocol) ||
        url.origin !== origin
      ) {
        throw new Error("not an exact HTTP origin");
      }
    } catch {
      productionErrors.CORS_ORIGINS = [
        "CORS_ORIGINS must contain exact HTTP(S) origins without paths or trailing slashes.",
      ];
      break;
    }
  }
  if (env.NODE_ENV === "production") {
    if (env.COOKIE_SAME_SITE !== "none") {
      productionErrors.COOKIE_SAME_SITE = [
        "The Vercel-to-Render deployment requires COOKIE_SAME_SITE=none.",
      ];
    }
    if (env.TRUST_PROXY_HOPS < 1) {
      productionErrors.TRUST_PROXY_HOPS = [
        "Render deployment requires a bounded trusted proxy hop count.",
      ];
    }
    if (env.IMAGE_STORAGE_PROVIDER !== "cloudinary") {
      productionErrors.IMAGE_STORAGE_PROVIDER = [
        "Production requires durable Cloudinary image storage.",
      ];
    }
    for (const key of [
      "CLOUDINARY_CLOUD_NAME",
      "CLOUDINARY_API_KEY",
      "CLOUDINARY_API_SECRET",
    ] as const) {
      if (!env[key])
        productionErrors[key] = ["Required for Cloudinary storage."];
    }
    if (new URL(env.PUBLIC_WEB_ORIGIN).protocol !== "https:") {
      productionErrors.PUBLIC_WEB_ORIGIN = [
        "Production web origin must use HTTPS.",
      ];
    }
    if (
      env.CORS_ORIGINS.length === 0 ||
      env.CORS_ORIGINS.some((origin) => !origin.startsWith("https://"))
    ) {
      productionErrors.CORS_ORIGINS = [
        "Production CORS origins must be explicit HTTPS origins.",
      ];
    }
  }
  if (Object.keys(productionErrors).length > 0) {
    console.error("Invalid environment configuration", productionErrors);
    throw new Error("Invalid environment configuration");
  }

  return env;
}
