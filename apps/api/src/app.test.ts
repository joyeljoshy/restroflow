import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import type { AuthServiceContract } from "./modules/auth/auth.service.js";
import type { HealthRepository } from "./modules/health/health.repository.js";

function buildApp(databaseAvailable: boolean) {
  const healthRepository: HealthRepository = {
    isDatabaseAvailable: () => Promise.resolve(databaseAvailable),
  };
  const authService: AuthServiceContract = {
    login: () => Promise.reject(new Error("Not used by health tests")),
    authenticate: () => Promise.reject(new Error("Not used by health tests")),
    logout: () => Promise.resolve(),
  };
  return createApp({
    allowedOrigins: ["http://localhost:3000"],
    authService,
    cookieOptions: { secure: false, maxAgeMs: 60_000 },
    healthRepository,
    loginRateLimitMax: 5,
    logger: pino({ enabled: false }),
    restaurantService: {
      get: () => Promise.reject(new Error("Not used by health tests")),
      update: () => Promise.reject(new Error("Not used by health tests")),
    },
    staffService: {
      list: () => Promise.reject(new Error("Not used by health tests")),
      create: () => Promise.reject(new Error("Not used by health tests")),
      update: () => Promise.reject(new Error("Not used by health tests")),
    },
  });
}

describe("GET /api/v1/health", () => {
  it("returns the shared healthy response", async () => {
    const response = await request(buildApp(true))
      .get("/api/v1/health")
      .expect(200);
    expect(response.body).toMatchObject({
      status: "ok",
      service: "restroflow-api",
      checks: { database: "up" },
    });
    expect(response.headers["x-request-id"]).toBeTypeOf("string");
  });

  it("reports degraded readiness when PostgreSQL is unavailable", async () => {
    const response = await request(buildApp(false))
      .get("/api/v1/health")
      .expect(503);
    expect(response.body).toMatchObject({
      status: "degraded",
      checks: { database: "down" },
    });
  });

  it("uses the centralized not-found shape", async () => {
    const response = await request(buildApp(true)).get("/missing").expect(404);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });
});
