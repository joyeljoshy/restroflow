import { describe, expect, it, vi } from "vitest";

import { loadEnvironment } from "./env.js";

const databaseUrl = "postgresql://user:password@localhost:5432/restroflow";

it("rejects remote databases during local API startup without printing the URL", () => {
  const remoteDatabaseUrl =
    "postgresql://fixture:secret@ep-example.neon.tech/demo";
  const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
  try {
    expect(() => loadEnvironment({ DATABASE_URL: remoteDatabaseUrl })).toThrow(
      "Invalid environment configuration",
    );
    expect(JSON.stringify(log.mock.calls)).not.toContain(remoteDatabaseUrl);
  } finally {
    log.mockRestore();
  }
});

describe("production environment validation", () => {
  const production = {
    NODE_ENV: "production",
    DATABASE_URL: databaseUrl,
    CORS_ORIGINS: "https://restroflow.vercel.app",
    PUBLIC_WEB_ORIGIN: "https://restroflow.vercel.app",
    COOKIE_SAME_SITE: "none",
    TRUST_PROXY_HOPS: "1",
    IMAGE_STORAGE_PROVIDER: "cloudinary",
    CLOUDINARY_CLOUD_NAME: "restroflow-demo",
    CLOUDINARY_API_KEY: "api-key",
    CLOUDINARY_API_SECRET: "api-secret",
  };

  it("accepts the explicit Vercel, Render, and Cloudinary configuration", () => {
    const env = loadEnvironment({
      ...production,
      CUSTOMER_PROXY_SECRET: "a".repeat(64),
    });

    expect(env).toMatchObject({
      COOKIE_SAME_SITE: "none",
      TRUST_PROXY_HOPS: 1,
      IMAGE_STORAGE_PROVIDER: "cloudinary",
      HOST: "0.0.0.0",
    });
  });

  it.each([undefined, "invalid-test-value"])(
    "rejects missing or malformed production proxy credentials",
    (secret) => {
      const log = vi
        .spyOn(console, "error")
        .mockImplementation(() => undefined);
      try {
        expect(() =>
          loadEnvironment({ ...production, CUSTOMER_PROXY_SECRET: secret }),
        ).toThrow("Invalid environment configuration");
        expect(log.mock.calls[0]?.[0]).toBe(
          "Invalid environment configuration",
        );
        expect(log.mock.calls[0]?.[1]).toHaveProperty("CUSTOMER_PROXY_SECRET");
        if (secret)
          expect(JSON.stringify(log.mock.calls)).not.toContain(secret);
      } finally {
        log.mockRestore();
      }
    },
  );

  it("allows local startup without proxy credentials", () => {
    expect(
      loadEnvironment({ DATABASE_URL: databaseUrl }).CUSTOMER_PROXY_SECRET,
    ).toBeUndefined();
  });

  it("rejects production defaults that would lose images or cookies", () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(() =>
      loadEnvironment({
        NODE_ENV: "production",
        DATABASE_URL: databaseUrl,
        CORS_ORIGINS: "https://restroflow.vercel.app",
        PUBLIC_WEB_ORIGIN: "https://restroflow.vercel.app",
      }),
    ).toThrow("Invalid environment configuration");
    vi.restoreAllMocks();
  });
});
