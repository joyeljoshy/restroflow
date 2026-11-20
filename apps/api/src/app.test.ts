import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import pino from "pino";
import request from "supertest";
import { afterEach, describe, expect, it } from "vitest";

import { createApp } from "./app.js";
import type { AuthServiceContract } from "./modules/auth/auth.service.js";
import type { HealthRepository } from "./modules/health/health.repository.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

function buildApp(databaseAvailable: boolean, menuImageDirectory?: string) {
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
    menuImageDirectory,
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

  it("keeps liveness independent from PostgreSQL readiness", async () => {
    await request(buildApp(false))
      .get("/api/v1/health/live")
      .expect(200, /restroflow-api/);
    await request(buildApp(false)).get("/api/v1/health/ready").expect(503);
  });

  it("rejects unsafe browser requests from untrusted origins", async () => {
    const response = await request(buildApp(true))
      .post("/api/v1/auth/logout")
      .set("Origin", "http://attacker.localhost:3001")
      .expect(403);
    expect(response.body).toMatchObject({
      error: { code: "ORIGIN_FORBIDDEN" },
    });
  });

  it("allows unsafe requests from trusted origins and non-browser clients", async () => {
    await request(buildApp(true))
      .post("/api/v1/auth/logout")
      .set("Origin", "http://localhost:3000")
      .expect(204);
    await request(buildApp(true)).post("/api/v1/auth/logout").expect(204);
  });

  it("uses the centralized not-found shape", async () => {
    const response = await request(buildApp(true)).get("/missing").expect(404);
    const body = response.body as { error: { code: string } };
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("allows the web origin to embed locally stored menu images", async () => {
    const directory = await mkdtemp(
      path.join(tmpdir(), "restroflow-static-menu-"),
    );
    temporaryDirectories.push(directory);
    await writeFile(path.join(directory, "preview.png"), Buffer.from("image"));

    const response = await request(buildApp(true, directory))
      .get("/uploads/menu/preview.png")
      .expect(200);

    expect(response.headers["cross-origin-resource-policy"]).toBe(
      "cross-origin",
    );
    expect(response.headers["content-type"]).toContain("image/png");
  });
});
