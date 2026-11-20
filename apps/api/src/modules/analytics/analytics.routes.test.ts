import type {
  AnalyticsOverview,
  AuthenticatedUser,
  Role,
} from "@restroflow/contracts";
import { errorResponseSchema } from "@restroflow/contracts";
import pino from "pino";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import type { AnalyticsServiceContract } from "./analytics.service.js";

const restaurantId = "10000000-0000-4000-8000-000000000001";
const membershipId = "10000000-0000-4000-8000-000000000002";

function authService(role: Role): AuthServiceContract {
  const user: AuthenticatedUser = {
    id: "10000000-0000-4000-8000-000000000003",
    email: "analytics@example.test",
    displayName: "Analytics Staff",
    memberships: [{ restaurantId, restaurantName: "Analytics Test", role }],
  };
  return {
    login: () => Promise.reject(new Error("unused")),
    logout: () => Promise.resolve(),
    authenticate: () =>
      Promise.resolve({
        user,
        sessionTokenHash: "test",
        membershipIds: { [restaurantId]: membershipId },
      }),
  };
}

const overview: AnalyticsOverview = {
  context: {
    startDate: "2026-11-01",
    endDate: "2026-12-01",
    granularity: "day",
    timezone: "Asia/Kolkata",
    currency: "INR",
    endExclusive: true,
  },
  finalizedSales: { value: "0", previousValue: "0", changePercent: null },
  recordedPayments: { value: "0", previousValue: "0", changePercent: null },
  currentOutstandingMinor: "0",
  periodOutstandingMinor: "0",
  finalizedBillCount: { value: 0, previousValue: 0, changePercent: null },
  completedOrderCount: { value: 0, previousValue: 0, changePercent: null },
  averageBillValueMinor: "0",
  activeTableSessions: 0,
  activeKitchenOrders: 0,
};

function app(role: Role) {
  const unused = () => Promise.reject(new Error("unused"));
  const analyticsService: AnalyticsServiceContract = {
    overview: () => Promise.resolve(overview),
    sales: unused,
    payments: unused,
    popularItems: unused,
    orders: unused,
    tables: unused,
    kitchen: unused,
  };
  return createApp({
    allowedOrigins: ["http://localhost:3000"],
    authService: authService(role),
    cookieOptions: { secure: false, maxAgeMs: 60_000 },
    healthRepository: { isDatabaseAvailable: () => Promise.resolve(true) },
    loginRateLimitMax: 50,
    logger: pino({ enabled: false }),
    restaurantService: { get: unused, update: unused },
    staffService: { list: unused, create: unused, update: unused },
    analyticsService,
  });
}

describe("analytics routes", () => {
  it("allows administrators and validates bounded date ranges", async () => {
    await request(app("ADMIN"))
      .get(
        "/api/v1/analytics/overview?startDate=2026-11-01&endDate=2026-12-01&granularity=day",
      )
      .set("x-restaurant-id", restaurantId)
      .expect(200);

    await request(app("ADMIN"))
      .get(
        "/api/v1/analytics/overview?startDate=2026-12-01&endDate=2026-11-01&granularity=day",
      )
      .set("x-restaurant-id", restaurantId)
      .expect(400);
  });

  it.each<Role>(["WAITER", "KITCHEN", "CASHIER"])(
    "rejects confidential analytics access for %s",
    async (role) => {
      const response = await request(app(role))
        .get(
          "/api/v1/analytics/overview?startDate=2026-11-01&endDate=2026-12-01&granularity=day",
        )
        .set("x-restaurant-id", restaurantId)
        .expect(403);
      expect(errorResponseSchema.parse(response.body).error.code).toBe(
        "ROLE_FORBIDDEN",
      );
    },
  );
});
