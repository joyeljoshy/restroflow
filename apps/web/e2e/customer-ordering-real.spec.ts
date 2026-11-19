import { randomBytes, randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";

import { expect, request, test } from "@playwright/test";
import pino from "pino";

import "../../api/src/types/express.d.ts";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile("../api/.env");
  } catch {
    // The live browser test self-skips when no local/CI database is configured.
  }
}

import { createApp } from "../../api/src/app.js";
import { createPrismaClient } from "../../api/src/lib/prisma.js";
import { PrismaAuthRepository } from "../../api/src/modules/auth/auth.repository.js";
import {
  Argon2PasswordHasher,
  AuthService,
} from "../../api/src/modules/auth/auth.service.js";
import { PrismaCustomerRepository } from "../../api/src/modules/customer/customer.repository.js";
import { CustomerService } from "../../api/src/modules/customer/customer.service.js";
import { PrismaHealthRepository } from "../../api/src/modules/health/health.repository.js";
import { PrismaOrderRepository } from "../../api/src/modules/orders/order.repository.js";
import { OrderService } from "../../api/src/modules/orders/order.service.js";
import {
  createRealtimeServer,
  SocketIoRealtimePublisher,
  type RealtimeServer,
} from "../../api/src/modules/realtime/realtime.server.js";
import { PrismaRestaurantRepository } from "../../api/src/modules/restaurants/restaurant.repository.js";
import { RestaurantService } from "../../api/src/modules/restaurants/restaurant.service.js";
import { PrismaStaffRepository } from "../../api/src/modules/staff/staff.repository.js";
import { StaffService } from "../../api/src/modules/staff/staff.service.js";

const databaseUrl = process.env.DATABASE_URL;
const liveApiUrl = process.env.REAL_CUSTOMER_API_URL ?? "http://localhost:4000";
const liveApi = new URL(liveApiUrl);
const liveApiPort = Number(
  liveApi.port || (liveApi.protocol === "https:" ? 443 : 80),
);
test.skip(
  !databaseUrl || process.env.REAL_CUSTOMER_E2E !== "1",
  "Set REAL_CUSTOMER_E2E=1 with DATABASE_URL to run the live customer flow.",
);

test.describe("live customer browser to kitchen flow", () => {
  const prisma = createPrismaClient(databaseUrl!);
  const suffix = randomUUID().slice(0, 8);
  const restaurantId = randomUUID();
  const userId = randomUUID();
  const membershipId = randomUUID();
  const tableId = randomUUID();
  const tableSessionId = randomUUID();
  const categoryId = randomUUID();
  const itemId = randomUUID();
  const identifier = randomBytes(32).toString("base64url");
  const email = `browser-customer-${suffix}@example.test`;
  const password = `Local-test-${randomUUID()}!`;
  let httpServer: HttpServer | undefined;
  let realtimeServer: RealtimeServer | undefined;

  test.beforeAll(async () => {
    const passwordHasher = new Argon2PasswordHasher();
    await prisma.restaurant.create({
      data: {
        id: restaurantId,
        name: `Live Browser Kitchen ${suffix}`,
        slug: `live-browser-kitchen-${suffix}`,
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email,
        displayName: "Live Browser Admin",
        passwordHash: await passwordHasher.hash(password),
      },
    });
    await prisma.staffMembership.create({
      data: {
        id: membershipId,
        userId,
        restaurantId,
        role: "ADMIN",
      },
    });
    await prisma.restaurantTable.create({
      data: {
        id: tableId,
        restaurantId,
        tableNumber: `LIVE-${suffix}`,
        displayName: "Live browser table",
        capacity: 2,
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
      data: { id: categoryId, restaurantId, name: `Live mains ${suffix}` },
    });
    await prisma.menuItem.create({
      data: {
        id: itemId,
        restaurantId,
        categoryId,
        name: "Live Paneer Plate",
        description: "Prepared through the real API",
        priceMinor: 12_500,
        isVegetarian: true,
      },
    });

    const authService = new AuthService(
      new PrismaAuthRepository(prisma),
      passwordHasher,
      60 * 60 * 1000,
    );
    const orderRepository = new PrismaOrderRepository(prisma);
    const publisher = new SocketIoRealtimePublisher();
    const orderService = new OrderService(orderRepository, publisher);
    const customerService = new CustomerService(
      new PrismaCustomerRepository(prisma),
      passwordHasher,
      orderService,
    );
    const cookieOptions = { secure: false, maxAgeMs: 60 * 60 * 1000 };
    const app = createApp({
      allowedOrigins: ["http://localhost:3100", "http://127.0.0.1:3100"],
      authService,
      cookieOptions,
      customerService,
      customerCookieOptions: cookieOptions,
      healthRepository: new PrismaHealthRepository(prisma),
      loginRateLimitMax: 50,
      logger: pino({ enabled: false }),
      restaurantService: new RestaurantService(
        new PrismaRestaurantRepository(prisma),
      ),
      staffService: new StaffService(
        new PrismaStaffRepository(prisma),
        passwordHasher,
      ),
      orderService,
    });
    const server = createServer(app);
    const realtime = createRealtimeServer(server, {
      allowedOrigins: ["http://localhost:3100", "http://127.0.0.1:3100"],
      authService,
      customerService,
      revalidateIntervalMs: 100,
    });
    publisher.attach(realtime, authService, customerService);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(liveApiPort, () => resolve());
    });
    httpServer = server;
    realtimeServer = realtime;
  });

  test.afterAll(async () => {
    const realtimeToClose = realtimeServer;
    const httpToClose = httpServer;
    if (realtimeToClose && httpToClose?.listening)
      await new Promise<void>((resolve, reject) => {
        void realtimeToClose.close((error) =>
          error ? reject(error) : resolve(),
        );
      });
    if (httpToClose?.listening)
      await new Promise<void>((resolve) => httpToClose.close(() => resolve()));

    await prisma.idempotencyKey.deleteMany({ where: { restaurantId } });
    await prisma.orderItemModifier.deleteMany({
      where: { orderItem: { restaurantId } },
    });
    await prisma.orderItemStatusHistory.deleteMany({ where: { restaurantId } });
    await prisma.orderStatusHistory.deleteMany({ where: { restaurantId } });
    await prisma.orderItem.deleteMany({ where: { restaurantId } });
    await prisma.order.deleteMany({ where: { restaurantId } });
    await prisma.tableOrderingActivation.deleteMany({
      where: { restaurantId },
    });
    await prisma.customerOrderingSession.deleteMany({
      where: { restaurantId },
    });
    await prisma.menuItem.deleteMany({ where: { restaurantId } });
    await prisma.menuCategory.deleteMany({ where: { restaurantId } });
    await prisma.tableSession.deleteMany({ where: { restaurantId } });
    await prisma.restaurantTable.deleteMany({ where: { restaurantId } });
    await prisma.session.deleteMany({ where: { userId } });
    await prisma.staffMembership.deleteMany({ where: { restaurantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await prisma.$disconnect();
  });

  test("persists a browser order, publishes it to KDS, and tracks kitchen progress", async ({
    page,
  }) => {
    const staff = await request.newContext({
      baseURL: liveApiUrl,
      extraHTTPHeaders: { origin: "http://localhost:3100" },
    });
    const login = await staff.post("/api/v1/auth/login", {
      data: { email, password },
    });
    expect(login.ok()).toBe(true);
    const issued = await staff.post(
      `/api/v1/table-sessions/${tableSessionId}/customer-access`,
      { headers: { "x-restaurant-id": restaurantId } },
    );
    expect(issued.ok()).toBe(true);
    const issuedBody = (await issued.json()) as {
      activation: { activationCode: string };
    };

    await page.goto(`http://localhost:3100/menu/table/${identifier}`);
    await expect(
      page.getByRole("heading", { name: /Live Browser Kitchen/ }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Customize & add" }).click();
    await page.getByRole("button", { name: "Add to cart" }).click();
    await page.getByRole("button", { name: /View cart/ }).click();
    await page.getByRole("button", { name: "Activate & submit" }).click();
    await page
      .getByLabel("6-digit activation code")
      .fill(issuedBody.activation.activationCode);
    await page.getByRole("button", { name: "Activate ordering" }).click();
    await page.getByRole("button", { name: /View cart/ }).click();
    await page.getByRole("button", { name: "Submit order" }).click();
    await expect(
      page.getByRole("heading", { name: "Order confirmed" }),
    ).toBeVisible();

    const stored = await prisma.order.findFirstOrThrow({
      where: { restaurantId, source: "CUSTOMER" },
      include: { items: true },
    });
    expect(stored.totalMinor).toBe(12_500);
    expect(stored.items[0]?.itemNameSnapshot).toBe("Live Paneer Plate");

    await page.getByRole("button", { name: "Track order" }).click();
    await expect(page.getByText("Sent to the restaurant")).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
    const accepted = await staff.patch(
      `/api/v1/kitchen/orders/${stored.id}/status`,
      {
        headers: { "x-restaurant-id": restaurantId },
        data: { version: stored.version, status: "ACCEPTED" },
      },
    );
    expect(accepted.ok()).toBe(true);
    const acceptedBody = (await accepted.json()) as {
      order: { version: number };
    };
    const preparing = await staff.patch(
      `/api/v1/kitchen/orders/${stored.id}/status`,
      {
        headers: { "x-restaurant-id": restaurantId },
        data: {
          version: acceptedBody.order.version,
          status: "PREPARING",
        },
      },
    );
    expect(preparing.ok()).toBe(true);
    await expect(page.getByText("Your food is being prepared")).toBeVisible();
    await staff.dispose();
  });
});
