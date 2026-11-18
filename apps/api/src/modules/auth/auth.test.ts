import {
  authResponseSchema,
  errorResponseSchema,
  type AuthenticatedUser,
} from "@restroflow/contracts";
import express from "express";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { errorHandler } from "../../middleware/error-handler.js";
import type {
  AuthRepository,
  AuthUserRecord,
  SessionRecord,
} from "./auth.repository.js";
import {
  requireAuth,
  requireRestaurantAccess,
  requireRole,
} from "./auth.middleware.js";
import {
  Argon2PasswordHasher,
  AuthService,
  type AuthServiceContract,
  type PasswordHasher,
} from "./auth.service.js";

const restaurantId = "9010e67f-4aa1-428e-bc26-6de08366aab2";
const otherRestaurantId = "ab88f4ee-d8e4-4dc6-8400-99ee336983e7";
const userId = "f2bb8ad8-efb4-4d6a-a942-d31a4b432fb2";

const adminUser: AuthUserRecord = {
  id: userId,
  email: "admin@example.com",
  displayName: "Admin",
  passwordHash: "stored-hash",
  isActive: true,
  memberships: [
    {
      restaurantId,
      restaurantName: "RestroFlow Demo",
      role: "ADMIN",
    },
  ],
};

class MemoryAuthRepository implements AuthRepository {
  session: SessionRecord | null = null;

  constructor(private readonly user: AuthUserRecord | null = adminUser) {}

  findUserByEmail(email: string): Promise<AuthUserRecord | null> {
    return Promise.resolve(this.user?.email === email ? this.user : null);
  }

  createSession(input: {
    userId: string;
    tokenHash: string;
    expiresAt: Date;
  }): Promise<void> {
    if (!this.user || input.userId !== this.user.id)
      throw new Error("Unknown test user");
    this.session = {
      tokenHash: input.tokenHash,
      expiresAt: input.expiresAt,
      revokedAt: null,
      user: this.user,
    };
    return Promise.resolve();
  }

  findSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null> {
    return Promise.resolve(
      this.session?.tokenHash === tokenHash ? this.session : null,
    );
  }

  revokeSession(tokenHash: string, revokedAt: Date): Promise<void> {
    if (this.session?.tokenHash === tokenHash)
      this.session.revokedAt = revokedAt;
    return Promise.resolve();
  }
}

const validPasswordHasher: PasswordHasher = {
  hash: () => Promise.resolve("stored-hash"),
  verify: (hash, password) =>
    Promise.resolve(hash === "stored-hash" && password === "valid-password"),
};

function createTestAuthService(
  repository: AuthRepository,
  now = new Date("2026-01-01T00:00:00.000Z"),
) {
  return new AuthService(
    repository,
    validPasswordHasher,
    60 * 60 * 1000,
    () => now,
    () => "test-session-token",
  );
}

function createAuthApp(
  authService: AuthServiceContract,
  loginRateLimitMax = 50,
) {
  return createApp({
    allowedOrigins: ["http://localhost:3000"],
    authService,
    cookieOptions: { secure: false, maxAgeMs: 60 * 60 * 1000 },
    healthRepository: { isDatabaseAvailable: () => Promise.resolve(true) },
    loginRateLimitMax,
    logger: pino({ enabled: false }),
  });
}

describe("staff authentication", () => {
  it("logs in with valid credentials and persists a hashed session", async () => {
    const repository = new MemoryAuthRepository();
    const response = await request(
      createAuthApp(createTestAuthService(repository)),
    )
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "valid-password" })
      .expect(200);

    const body = authResponseSchema.parse(response.body as unknown);
    expect(body.user).toMatchObject({
      id: userId,
      memberships: [{ restaurantId, role: "ADMIN" }],
    });
    expect(response.headers["set-cookie"]?.[0]).toContain(
      "restroflow_session=test-session-token",
    );
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(repository.session?.tokenHash).not.toBe("test-session-token");
  });

  it("returns one generic error for invalid credentials", async () => {
    const response = await request(
      createAuthApp(createTestAuthService(new MemoryAuthRepository())),
    )
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "wrong-password" })
      .expect(401);

    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      "INVALID_CREDENTIALS",
    );
  });

  it("restores the authenticated user from the session cookie", async () => {
    const service = createTestAuthService(new MemoryAuthRepository());
    const agent = request.agent(createAuthApp(service));
    await agent
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "valid-password" })
      .expect(200);

    const response = await agent.get("/api/v1/auth/me").expect(200);
    expect(authResponseSchema.parse(response.body as unknown).user.email).toBe(
      "admin@example.com",
    );
  });

  it("rate limits repeated failed login attempts", async () => {
    const app = createAuthApp(
      createTestAuthService(new MemoryAuthRepository()),
      1,
    );
    await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "wrong-password" })
      .expect(401);
    const response = await request(app)
      .post("/api/v1/auth/login")
      .send({ email: "admin@example.com", password: "wrong-password" })
      .expect(429);
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      "LOGIN_RATE_LIMITED",
    );
  });

  it("rejects and revokes expired sessions", async () => {
    const repository = new MemoryAuthRepository();
    const loginTime = new Date("2026-01-01T00:00:00.000Z");
    const service = createTestAuthService(repository, loginTime);
    await service.login({
      email: "admin@example.com",
      password: "valid-password",
    });
    const expiredService = createTestAuthService(
      repository,
      new Date("2026-01-01T02:00:00.000Z"),
    );

    await expect(
      expiredService.authenticate("test-session-token"),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED" });
    expect(repository.session?.revokedAt).not.toBeNull();
  });

  it("rejects unauthenticated API requests", async () => {
    const response = await request(
      createAuthApp(createTestAuthService(new MemoryAuthRepository())),
    )
      .get("/api/v1/auth/me")
      .expect(401);
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      "UNAUTHENTICATED",
    );
  });

  it("invalidates the session during logout", async () => {
    const repository = new MemoryAuthRepository();
    const service = createTestAuthService(repository);
    await service.login({
      email: "admin@example.com",
      password: "valid-password",
    });

    await request(createAuthApp(service))
      .post("/api/v1/auth/logout")
      .set("Cookie", "restroflow_session=test-session-token")
      .expect(204);
    expect(repository.session?.revokedAt).not.toBeNull();
  });

  it("creates Argon2id hashes", async () => {
    const hasher = new Argon2PasswordHasher();
    const hash = await hasher.hash("a-development-only-password");
    expect(hash).toMatch(/^\$argon2id\$/);
    await expect(
      hasher.verify(hash, "a-development-only-password"),
    ).resolves.toBe(true);
  });
});

function buildAuthorizationApp(auth: AuthenticatedUser) {
  const authService: AuthServiceContract = {
    login: () => Promise.reject(new Error("Not used")),
    logout: () => Promise.resolve(),
    authenticate: () =>
      Promise.resolve({ user: auth, sessionTokenHash: "token-hash" }),
  };
  const app = express();
  app.get(
    "/restaurants/:restaurantId/admin",
    requireAuth(authService, { secure: false, maxAgeMs: 60_000 }),
    requireRestaurantAccess,
    requireRole("ADMIN", "MANAGER"),
    (_req, res) => res.status(204).send(),
  );
  app.use(errorHandler);
  return app;
}

describe("staff authorization middleware", () => {
  it("allows a permitted role for its restaurant", async () => {
    await request(
      buildAuthorizationApp({
        id: userId,
        email: "admin@example.com",
        displayName: "Admin",
        memberships: adminUser.memberships,
      }),
    )
      .get(`/restaurants/${restaurantId}/admin`)
      .expect(204);
  });

  it("rejects a role-restricted request", async () => {
    const response = await request(
      buildAuthorizationApp({
        id: userId,
        email: "waiter@example.com",
        displayName: "Waiter",
        memberships: [
          {
            restaurantId,
            restaurantName: "RestroFlow Demo",
            role: "WAITER",
          },
        ],
      }),
    )
      .get(`/restaurants/${restaurantId}/admin`)
      .expect(403);
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      "ROLE_FORBIDDEN",
    );
  });

  it("rejects access to a restaurant outside the session memberships", async () => {
    const response = await request(
      buildAuthorizationApp({
        id: userId,
        email: "admin@example.com",
        displayName: "Admin",
        memberships: adminUser.memberships,
      }),
    )
      .get(`/restaurants/${otherRestaurantId}/admin`)
      .expect(403);
    expect(errorResponseSchema.parse(response.body as unknown).error.code).toBe(
      "RESTAURANT_ACCESS_DENIED",
    );
  });
});
