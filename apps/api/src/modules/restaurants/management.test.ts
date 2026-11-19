import {
  errorResponseSchema,
  restaurantResponseSchema,
  staffListResponseSchema,
  staffResponseSchema,
  type AuthenticatedUser,
  type Role,
  type StaffListQuery,
  type UpdateRestaurantRequest,
  type UpdateStaffRequest,
} from "@restroflow/contracts";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import type { AuthRepository } from "../auth/auth.repository.js";
import {
  AuthService,
  type AuthServiceContract,
  type PasswordHasher,
} from "../auth/auth.service.js";
import type {
  RestaurantRecord,
  RestaurantRepository,
} from "./restaurant.repository.js";
import { RestaurantService } from "./restaurant.service.js";
import type {
  CreateStaffRecord,
  StaffRecord,
  StaffRepository,
} from "../staff/staff.repository.js";
import { StaffService } from "../staff/staff.service.js";

const restaurantId = "9010e67f-4aa1-428e-bc26-6de08366aab2";
const otherRestaurantId = "ab88f4ee-d8e4-4dc6-8400-99ee336983e7";
const adminStaffId = "97a2cbe2-5761-4b1d-8e30-3c4f5b4e766e";
const adminUserId = "f2bb8ad8-efb4-4d6a-a942-d31a4b432fb2";
const fixedDate = new Date("2026-11-18T10:00:00.000Z");

class MemoryRestaurantRepository implements RestaurantRepository {
  restaurant: RestaurantRecord = {
    id: restaurantId,
    name: "RestroFlow Demo",
    slug: "restroflow-demo",
    address: null,
    phone: null,
    email: null,
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxName: "GST",
    taxRateBasisPoints: 0,
    pricesIncludeTax: false,
    createdAt: fixedDate,
    updatedAt: fixedDate,
  };

  findById(id: string): Promise<RestaurantRecord | null> {
    return Promise.resolve(id === restaurantId ? this.restaurant : null);
  }

  update(
    id: string,
    input: UpdateRestaurantRequest,
  ): Promise<RestaurantRecord> {
    if (id !== restaurantId) throw new Error("Unknown restaurant");
    this.restaurant = { ...this.restaurant, ...input, updatedAt: fixedDate };
    return Promise.resolve(this.restaurant);
  }
}

class MemoryStaffRepository implements StaffRepository {
  records: StaffRecord[] = [
    {
      id: adminStaffId,
      userId: adminUserId,
      displayName: "Primary Admin",
      email: "admin@example.com",
      role: "ADMIN",
      isActive: true,
      createdAt: fixedDate,
      updatedAt: fixedDate,
    },
  ];
  passwordHashes = new Map([[adminUserId, "hashed:admin-password"]]);
  revokedUsers: string[] = [];
  userActive = new Map([[adminUserId, true]]);
  private nextId = 0;

  async withTransaction<T>(
    operation: (repository: StaffRepository) => Promise<T>,
  ): Promise<T> {
    const records = this.records.map((record) => ({ ...record }));
    const hashes = new Map(this.passwordHashes);
    const revoked = [...this.revokedUsers];
    const active = new Map(this.userActive);
    try {
      return await operation(this);
    } catch (error) {
      this.records = records;
      this.passwordHashes = hashes;
      this.revokedUsers = revoked;
      this.userActive = active;
      throw error;
    }
  }

  list(restaurant: string, query: StaffListQuery): Promise<StaffRecord[]> {
    if (restaurant !== restaurantId) return Promise.resolve([]);
    return Promise.resolve(
      this.records.filter(
        (record) =>
          (query.status === "all" ||
            record.isActive === (query.status === "active")) &&
          (!query.role || record.role === query.role) &&
          (!query.search ||
            `${record.displayName} ${record.email}`
              .toLowerCase()
              .includes(query.search.toLowerCase())),
      ),
    );
  }

  findById(restaurant: string, staffId: string): Promise<StaffRecord | null> {
    if (restaurant !== restaurantId) return Promise.resolve(null);
    return Promise.resolve(
      this.records.find((record) => record.id === staffId) ?? null,
    );
  }

  emailExists(email: string, excludingUserId?: string): Promise<boolean> {
    return Promise.resolve(
      this.records.some(
        (record) => record.email === email && record.userId !== excludingUserId,
      ),
    );
  }

  create(restaurant: string, input: CreateStaffRecord): Promise<StaffRecord> {
    if (restaurant !== restaurantId) throw new Error("Unknown restaurant");
    this.nextId += 1;
    const suffix = this.nextId.toString().padStart(12, "0");
    const userId = `10000000-0000-4000-8000-${suffix}`;
    const record: StaffRecord = {
      id: `20000000-0000-4000-8000-${suffix}`,
      userId,
      displayName: input.displayName,
      email: input.email,
      role: input.role,
      isActive: true,
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };
    this.records.push(record);
    this.passwordHashes.set(userId, input.passwordHash);
    this.userActive.set(userId, true);
    return Promise.resolve(record);
  }

  update(
    restaurant: string,
    staffId: string,
    input: UpdateStaffRequest,
  ): Promise<StaffRecord> {
    const index = this.records.findIndex(
      (record) => record.id === staffId && restaurant === restaurantId,
    );
    if (index < 0) throw new Error("Unknown staff member");
    const current = this.records[index]!;
    const updated = { ...current, ...input, updatedAt: fixedDate };
    this.records[index] = updated;
    return Promise.resolve(updated);
  }

  countActiveAdmins(restaurant: string): Promise<number> {
    return Promise.resolve(
      restaurant === restaurantId
        ? this.records.filter(
            (record) => record.role === "ADMIN" && record.isActive,
          ).length
        : 0,
    );
  }

  countActiveMemberships(userId: string): Promise<number> {
    return Promise.resolve(
      this.records.filter(
        (record) => record.userId === userId && record.isActive,
      ).length,
    );
  }

  setUserActive(userId: string, isActive: boolean): Promise<void> {
    this.userActive.set(userId, isActive);
    return Promise.resolve();
  }

  revokeSessions(userId: string): Promise<void> {
    this.revokedUsers.push(userId);
    return Promise.resolve();
  }
}

const passwordHasher: PasswordHasher = {
  hash: (password) => Promise.resolve(`hashed:${password}`),
  verify: (hash, password) => Promise.resolve(hash === `hashed:${password}`),
};

function authService(role: Role, scopedRestaurantId = restaurantId) {
  const user: AuthenticatedUser = {
    id: adminUserId,
    email: "admin@example.com",
    displayName: "Primary Admin",
    memberships: [
      {
        restaurantId: scopedRestaurantId,
        restaurantName: "RestroFlow Demo",
        role,
      },
    ],
  };
  const service: AuthServiceContract = {
    login: () => Promise.reject(new Error("Not used")),
    logout: () => Promise.resolve(),
    authenticate: () =>
      Promise.resolve({
        user,
        sessionTokenHash: "hash",
        membershipIds: { [scopedRestaurantId]: adminStaffId },
      }),
  };
  return service;
}

function settingsBody(): UpdateRestaurantRequest {
  return {
    name: "Cafe Aurora",
    slug: "cafe-aurora",
    address: "12 Market Street",
    phone: "+91 98765 43210",
    email: "hello@aurora.example",
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxName: "GST",
    taxRateBasisPoints: 1800,
    pricesIncludeTax: true,
  };
}

describe("restaurant and staff management API", () => {
  let restaurants: MemoryRestaurantRepository;
  let staff: MemoryStaffRepository;

  beforeEach(() => {
    restaurants = new MemoryRestaurantRepository();
    staff = new MemoryStaffRepository();
  });

  function buildApp(role: Role = "ADMIN", scope = restaurantId) {
    return createApp({
      allowedOrigins: ["http://localhost:3000"],
      authService: authService(role, scope),
      cookieOptions: { secure: false, maxAgeMs: 60_000 },
      healthRepository: { isDatabaseAvailable: () => Promise.resolve(true) },
      loginRateLimitMax: 50,
      logger: pino({ enabled: false }),
      restaurantService: new RestaurantService(restaurants),
      staffService: new StaffService(staff, passwordHasher, () => fixedDate),
    });
  }

  it("views and updates restaurant settings as an admin", async () => {
    const app = buildApp();
    const before = await request(app)
      .get(`/api/v1/restaurants/${restaurantId}`)
      .expect(200);
    expect(
      restaurantResponseSchema.parse(before.body as unknown).restaurant.name,
    ).toBe("RestroFlow Demo");

    const response = await request(app)
      .patch(`/api/v1/restaurants/${restaurantId}`)
      .send(settingsBody())
      .expect(200);
    expect(
      restaurantResponseSchema.parse(response.body as unknown).restaurant,
    ).toMatchObject({ name: "Cafe Aurora", taxRateBasisPoints: 1800 });
  });

  it("rejects invalid settings and manager mutations", async () => {
    const invalid = await request(buildApp())
      .patch(`/api/v1/restaurants/${restaurantId}`)
      .send({ ...settingsBody(), currency: "RUPEES" })
      .expect(400);
    expect(errorResponseSchema.parse(invalid.body).error.code).toBe(
      "VALIDATION_ERROR",
    );

    const forbidden = await request(buildApp("MANAGER"))
      .patch(`/api/v1/restaurants/${restaurantId}`)
      .send(settingsBody())
      .expect(403);
    expect(errorResponseSchema.parse(forbidden.body).error.code).toBe(
      "ROLE_FORBIDDEN",
    );
  });

  it("creates searchable staff accounts that can authenticate", async () => {
    const response = await request(buildApp())
      .post(`/api/v1/restaurants/${restaurantId}/staff`)
      .send({
        displayName: "Priya Shah",
        email: "priya@example.com",
        password: "correct-horse-battery-staple",
        role: "WAITER",
      })
      .expect(201);
    const created = staffResponseSchema.parse(response.body).staffMember;
    expect(created).toMatchObject({
      email: "priya@example.com",
      role: "WAITER",
    });
    expect(response.body).not.toHaveProperty("staffMember.passwordHash");

    const authRepository: AuthRepository = {
      findUserByEmail: (email) => {
        const record = staff.records.find(
          (candidate) => candidate.email === email,
        );
        return Promise.resolve(
          record
            ? {
                id: record.userId,
                email: record.email,
                displayName: record.displayName,
                passwordHash: staff.passwordHashes.get(record.userId)!,
                isActive: staff.userActive.get(record.userId) ?? false,
                memberships: [
                  {
                    id: record.id,
                    restaurantId,
                    restaurantName: "RestroFlow Demo",
                    role: record.role,
                  },
                ],
              }
            : null,
        );
      },
      createSession: () => Promise.resolve(),
      findSessionByTokenHash: () => Promise.resolve(null),
      revokeSession: () => Promise.resolve(),
    };
    await expect(
      new AuthService(authRepository, passwordHasher, 60_000).login({
        email: "priya@example.com",
        password: "correct-horse-battery-staple",
      }),
    ).resolves.toMatchObject({ user: { email: "priya@example.com" } });

    const listing = await request(buildApp())
      .get(`/api/v1/restaurants/${restaurantId}/staff`)
      .query({ search: "priya", role: "WAITER", status: "active" })
      .expect(200);
    expect(staffListResponseSchema.parse(listing.body).total).toBe(1);
  });

  it("updates a staff profile and invalidates sessions on deactivation", async () => {
    const created = await new StaffService(staff, passwordHasher).create(
      restaurantId,
      {
        displayName: "Arun Rao",
        email: "arun@example.com",
        password: "correct-horse-battery-staple",
        role: "KITCHEN",
      },
    );

    const response = await request(buildApp())
      .patch(`/api/v1/restaurants/${restaurantId}/staff/${created.id}`)
      .send({ displayName: "Arun Kumar", isActive: false })
      .expect(200);
    expect(staffResponseSchema.parse(response.body).staffMember).toMatchObject({
      displayName: "Arun Kumar",
      isActive: false,
    });
    const record = staff.records.find(
      (candidate) => candidate.id === created.id,
    )!;
    expect(staff.revokedUsers).toContain(record.userId);
    expect(staff.userActive.get(record.userId)).toBe(false);
  });

  it("protects the last active admin", async () => {
    const roleResponse = await request(buildApp())
      .patch(`/api/v1/restaurants/${restaurantId}/staff/${adminStaffId}`)
      .send({ role: "MANAGER" })
      .expect(409);
    expect(errorResponseSchema.parse(roleResponse.body).error.code).toBe(
      "LAST_ACTIVE_ADMIN",
    );

    const statusResponse = await request(buildApp())
      .patch(`/api/v1/restaurants/${restaurantId}/staff/${adminStaffId}`)
      .send({ isActive: false })
      .expect(409);
    expect(errorResponseSchema.parse(statusResponse.body).error.code).toBe(
      "LAST_ACTIVE_ADMIN",
    );
    expect(staff.records[0]?.role).toBe("ADMIN");
    expect(staff.records[0]?.isActive).toBe(true);
  });

  it("rejects invalid staff account input", async () => {
    const response = await request(buildApp())
      .post(`/api/v1/restaurants/${restaurantId}/staff`)
      .send({
        displayName: "Priya Shah",
        email: "not-an-email",
        password: "short",
        role: "OWNER",
      })
      .expect(400);
    expect(errorResponseSchema.parse(response.body).error.code).toBe(
      "VALIDATION_ERROR",
    );
  });

  it("blocks unauthorized roles and cross-restaurant access", async () => {
    const roleResponse = await request(buildApp("WAITER"))
      .get(`/api/v1/restaurants/${restaurantId}/staff`)
      .expect(403);
    expect(errorResponseSchema.parse(roleResponse.body).error.code).toBe(
      "ROLE_FORBIDDEN",
    );

    const isolationResponse = await request(buildApp("ADMIN"))
      .get(`/api/v1/restaurants/${otherRestaurantId}/staff`)
      .expect(403);
    expect(errorResponseSchema.parse(isolationResponse.body).error.code).toBe(
      "RESTAURANT_ACCESS_DENIED",
    );
  });
});
