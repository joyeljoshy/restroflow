import { randomBytes, randomUUID } from "node:crypto";
import { createServer } from "node:http";
import { performance } from "node:perf_hooks";

import pino from "pino";

import { createApp } from "../app.js";
import {
  classifyDatabaseTarget,
  requireBenchmarkDatabaseUrl,
} from "../config/database-target.js";
import { createPrismaClient } from "../lib/prisma.js";
import { PrismaAnalyticsRepository } from "../modules/analytics/analytics.repository.js";
import { AnalyticsService } from "../modules/analytics/analytics.service.js";
import { PrismaAuthRepository } from "../modules/auth/auth.repository.js";
import {
  Argon2PasswordHasher,
  AuthService,
} from "../modules/auth/auth.service.js";
import { PrismaBillingRepository } from "../modules/billing/billing.repository.js";
import { BillingService } from "../modules/billing/billing.service.js";
import { PrismaCustomerRepository } from "../modules/customer/customer.repository.js";
import { CustomerService } from "../modules/customer/customer.service.js";
import { PrismaHealthRepository } from "../modules/health/health.repository.js";
import { PrismaMenuRepository } from "../modules/menu/menu.repository.js";
import { MenuService } from "../modules/menu/menu.service.js";
import { PrismaOrderRepository } from "../modules/orders/order.repository.js";
import { OrderService } from "../modules/orders/order.service.js";
import { PrismaRestaurantRepository } from "../modules/restaurants/restaurant.repository.js";
import { RestaurantService } from "../modules/restaurants/restaurant.service.js";
import { PrismaStaffRepository } from "../modules/staff/staff.repository.js";
import { StaffService } from "../modules/staff/staff.service.js";
import { PrismaTableRepository } from "../modules/tables/table.repository.js";
import { TableService } from "../modules/tables/table.service.js";

if (process.env.NODE_ENV === "production")
  throw new Error("API load tests are disabled in production.");
const databaseUrl = requireBenchmarkDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.API_LOAD_TEST_ALLOW_REMOTE === "1",
);

const prisma = createPrismaClient(databaseUrl);
const suffix = randomUUID().slice(0, 8);
const restaurantId = randomUUID();
const userId = randomUUID();
const membershipId = randomUUID();
const tableId = randomUUID();
const tableSessionId = randomUUID();
const categoryId = randomUUID();
const menuItemId = randomUUID();
const identifier = randomBytes(32).toString("base64url");
const email = `api-load-${suffix}@example.test`;
const password = `Local-load-${randomUUID()}!`;
const origin = "http://127.0.0.1:3100";

type Target = {
  name: string;
  requestCount: number;
  concurrency: number;
  request: (index: number) => Promise<Response>;
};

function percentile(sorted: number[], value: number) {
  return sorted[Math.max(0, Math.ceil(sorted.length * value) - 1)] ?? 0;
}

async function measure(target: Target) {
  const latencies: number[] = [];
  let failures = 0;
  let nextIndex = 0;
  const started = performance.now();
  const workers = Array.from(
    { length: Math.min(target.concurrency, target.requestCount) },
    async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= target.requestCount) return;
        const requestStarted = performance.now();
        try {
          const response = await target.request(index);
          if (!response.ok) failures += 1;
          await response.arrayBuffer();
        } catch {
          failures += 1;
        } finally {
          latencies.push(performance.now() - requestStarted);
        }
      }
    },
  );
  await Promise.all(workers);
  const durationMs = performance.now() - started;
  const sorted = [...latencies].sort((left, right) => left - right);
  return {
    name: target.name,
    requestCount: target.requestCount,
    concurrency: target.concurrency,
    durationMs: Number(durationMs.toFixed(2)),
    throughputPerSecond: Number(
      ((target.requestCount * 1_000) / durationMs).toFixed(2),
    ),
    p50Ms: Number(percentile(sorted, 0.5).toFixed(2)),
    p95Ms: Number(percentile(sorted, 0.95).toFixed(2)),
    p99Ms: Number(percentile(sorted, 0.99).toFixed(2)),
    errorRate: failures / target.requestCount,
  };
}

async function cleanup() {
  await prisma.paymentIdempotency.deleteMany({ where: { restaurantId } });
  await prisma.payment.deleteMany({ where: { restaurantId } });
  await prisma.billItemModifier.deleteMany({ where: { restaurantId } });
  await prisma.billItem.deleteMany({ where: { restaurantId } });
  await prisma.bill.deleteMany({ where: { restaurantId } });
  await prisma.idempotencyKey.deleteMany({ where: { restaurantId } });
  await prisma.orderItemModifier.deleteMany({
    where: { orderItem: { restaurantId } },
  });
  await prisma.orderItemStatusHistory.deleteMany({ where: { restaurantId } });
  await prisma.orderStatusHistory.deleteMany({ where: { restaurantId } });
  await prisma.orderItem.deleteMany({ where: { restaurantId } });
  await prisma.order.deleteMany({ where: { restaurantId } });
  await prisma.tableOrderingActivation.deleteMany({ where: { restaurantId } });
  await prisma.customerOrderingSession.deleteMany({ where: { restaurantId } });
  await prisma.menuItem.deleteMany({ where: { restaurantId } });
  await prisma.menuCategory.deleteMany({ where: { restaurantId } });
  await prisma.tableSession.deleteMany({ where: { restaurantId } });
  await prisma.restaurantTable.deleteMany({ where: { restaurantId } });
  await prisma.session.deleteMany({ where: { userId } });
  await prisma.staffMembership.deleteMany({ where: { restaurantId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
}

async function main() {
  const passwordHasher = new Argon2PasswordHasher();
  await prisma.restaurant.create({
    data: {
      id: restaurantId,
      name: `API Load ${suffix}`,
      slug: `api-load-${suffix}`,
      timezone: "Asia/Kolkata",
    },
  });
  await prisma.user.create({
    data: {
      id: userId,
      email,
      displayName: "API Load Admin",
      passwordHash: await passwordHasher.hash(password),
    },
  });
  await prisma.staffMembership.create({
    data: { id: membershipId, restaurantId, userId, role: "ADMIN" },
  });
  await prisma.restaurantTable.create({
    data: {
      id: tableId,
      restaurantId,
      tableNumber: `LOAD-${suffix}`,
      displayName: "API load table",
      capacity: 4,
      qrIdentifier: identifier,
    },
  });
  await prisma.tableSession.create({
    data: {
      id: tableSessionId,
      restaurantId,
      tableId,
      openedByMembershipId: membershipId,
    },
  });
  await prisma.menuCategory.create({
    data: { id: categoryId, restaurantId, name: `Load menu ${suffix}` },
  });
  await prisma.menuItem.create({
    data: {
      id: menuItemId,
      restaurantId,
      categoryId,
      name: "Load test meal",
      priceMinor: 1_500,
    },
  });

  const authService = new AuthService(
    new PrismaAuthRepository(prisma),
    passwordHasher,
    60 * 60 * 1_000,
  );
  const orderService = new OrderService(new PrismaOrderRepository(prisma));
  const customerService = new CustomerService(
    new PrismaCustomerRepository(prisma),
    passwordHasher,
    orderService,
  );
  const app = createApp({
    allowedOrigins: [origin],
    authService,
    cookieOptions: { secure: false, maxAgeMs: 60 * 60 * 1_000 },
    customerCookieOptions: { secure: false, maxAgeMs: 60 * 60 * 1_000 },
    healthRepository: new PrismaHealthRepository(prisma),
    loginRateLimitMax: 100,
    logger: pino({ enabled: false }),
    restaurantService: new RestaurantService(
      new PrismaRestaurantRepository(prisma),
    ),
    staffService: new StaffService(
      new PrismaStaffRepository(prisma),
      passwordHasher,
    ),
    menuService: new MenuService(new PrismaMenuRepository(prisma)),
    tableService: new TableService(new PrismaTableRepository(prisma), origin),
    orderService,
    customerService,
    billingService: new BillingService(new PrismaBillingRepository(prisma)),
    analyticsService: new AnalyticsService(
      new PrismaAnalyticsRepository(prisma),
    ),
  });
  const server = createServer(app);

  try {
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", resolve);
    });
    const address = server.address();
    if (!address || typeof address === "string")
      throw new Error("Load-test server did not bind a TCP port.");
    const baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json", origin },
      body: JSON.stringify({ email, password }),
    });
    if (!login.ok) throw new Error(`Load-test login failed: ${login.status}`);
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("Load-test login returned no session cookie.");
    const authHeaders = {
      cookie,
      origin,
      "x-restaurant-id": restaurantId,
    };
    const authenticatedGet = (path: string) =>
      fetch(`${baseUrl}${path}`, { headers: authHeaders });

    const memoryBefore = process.memoryUsage().rss;
    const cpuBefore = process.cpuUsage();
    const targets: Target[] = [
      {
        name: "public-menu",
        requestCount: 100,
        concurrency: 10,
        request: () =>
          fetch(`${baseUrl}/public/tables/${identifier}/menu`, {
            headers: { origin },
          }),
      },
      {
        name: "authenticated-menu",
        requestCount: 100,
        concurrency: 10,
        request: () => authenticatedGet("/menu/items?page=1&limit=20"),
      },
      {
        name: "table-list",
        requestCount: 100,
        concurrency: 10,
        request: () => authenticatedGet("/tables"),
      },
      {
        name: "kitchen-tickets",
        requestCount: 100,
        concurrency: 10,
        request: () => authenticatedGet("/kitchen/tickets"),
      },
      {
        name: "analytics-overview",
        requestCount: 50,
        concurrency: 5,
        request: () =>
          authenticatedGet(
            "/analytics/overview?startDate=2026-11-01&endDate=2026-11-20&granularity=day",
          ),
      },
      {
        name: "billing-active-sessions",
        requestCount: 100,
        concurrency: 10,
        request: () => authenticatedGet("/billing/active-sessions"),
      },
      {
        name: "order-creation",
        requestCount: 25,
        concurrency: 5,
        request: (index) =>
          fetch(`${baseUrl}/orders`, {
            method: "POST",
            headers: {
              ...authHeaders,
              "content-type": "application/json",
              "idempotency-key": `load-${suffix}-${index}`,
            },
            body: JSON.stringify({
              tableSessionId,
              items: [{ menuItemId, quantity: 1, modifierIds: [] }],
            }),
          }),
      },
    ];
    const results = [];
    for (const target of targets) results.push(await measure(target));
    const cpu = process.cpuUsage(cpuBefore);
    console.log(
      JSON.stringify(
        {
          scope: { restaurantId, isolatedFixture: true, production: false },
          environment: {
            node: process.version,
            databaseTarget: classifyDatabaseTarget(databaseUrl),
            cpuUserMs: Number((cpu.user / 1_000).toFixed(2)),
            cpuSystemMs: Number((cpu.system / 1_000).toFixed(2)),
            rssBeforeBytes: memoryBefore,
            rssAfterBytes: process.memoryUsage().rss,
          },
          results,
        },
        null,
        2,
      ),
    );
  } finally {
    if (server.listening)
      await new Promise<void>((resolve) => server.close(() => resolve()));
    await cleanup();
    await prisma.$disconnect();
  }
}

await main();
