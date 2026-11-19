import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";

import { expect, test } from "@playwright/test";
import pino from "pino";

import "../../api/src/types/express.d.ts";

if (!process.env.DATABASE_URL) {
  try {
    process.loadEnvFile("../api/.env");
  } catch {
    // The live test self-skips when no local/CI database is configured.
  }
}

import { createApp } from "../../api/src/app.js";
import { createPrismaClient } from "../../api/src/lib/prisma.js";
import { PrismaAuthRepository } from "../../api/src/modules/auth/auth.repository.js";
import {
  Argon2PasswordHasher,
  AuthService,
} from "../../api/src/modules/auth/auth.service.js";
import { PrismaBillingRepository } from "../../api/src/modules/billing/billing.repository.js";
import { BillingService } from "../../api/src/modules/billing/billing.service.js";
import { PrismaHealthRepository } from "../../api/src/modules/health/health.repository.js";
import { PrismaRestaurantRepository } from "../../api/src/modules/restaurants/restaurant.repository.js";
import { RestaurantService } from "../../api/src/modules/restaurants/restaurant.service.js";
import { PrismaStaffRepository } from "../../api/src/modules/staff/staff.repository.js";
import { StaffService } from "../../api/src/modules/staff/staff.service.js";
import { PrismaTableRepository } from "../../api/src/modules/tables/table.repository.js";
import { TableService } from "../../api/src/modules/tables/table.service.js";

const databaseUrl = process.env.DATABASE_URL;
const liveApiUrl = process.env.REAL_BILLING_API_URL ?? "http://127.0.0.1:4011";
const liveApi = new URL(liveApiUrl);
const liveApiPort = Number(liveApi.port || 80);

test.skip(
  !databaseUrl || process.env.REAL_BILLING_E2E !== "1",
  "Set REAL_BILLING_E2E=1 and build the web app with NEXT_PUBLIC_API_URL matching REAL_BILLING_API_URL.",
);

test.describe("live browser billing flow", () => {
  const prisma = createPrismaClient(databaseUrl!);
  const suffix = randomUUID().slice(0, 8);
  const restaurantId = randomUUID();
  const userId = randomUUID();
  const membershipId = randomUUID();
  const tableId = randomUUID();
  const tableSessionId = randomUUID();
  const categoryId = randomUUID();
  const itemId = randomUUID();
  const email = `browser-billing-${suffix}@example.test`;
  const password = `Local-test-${randomUUID()}!`;
  let httpServer: HttpServer | undefined;

  test.beforeAll(async () => {
    const passwordHasher = new Argon2PasswordHasher();
    await prisma.restaurant.create({
      data: {
        id: restaurantId,
        name: `Live Billing ${suffix}`,
        slug: `live-billing-${suffix}`,
        address: "1 Browser Test Street",
        taxName: "GST",
        taxRateBasisPoints: 500,
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email,
        displayName: "Live Browser Cashier",
        passwordHash: await passwordHasher.hash(password),
      },
    });
    await prisma.staffMembership.create({
      data: {
        id: membershipId,
        userId,
        restaurantId,
        role: "CASHIER",
      },
    });
    await prisma.restaurantTable.create({
      data: {
        id: tableId,
        restaurantId,
        tableNumber: `BROWSER-${suffix}`,
        displayName: "Live billing table",
        capacity: 2,
        qrIdentifier: randomUUID().replaceAll("-", ""),
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
      data: { id: categoryId, restaurantId, name: `Live menu ${suffix}` },
    });
    await prisma.menuItem.create({
      data: {
        id: itemId,
        restaurantId,
        categoryId,
        name: "Live browser meal",
        priceMinor: 20_000,
      },
    });
    await prisma.order.create({
      data: {
        restaurantId,
        tableSessionId,
        orderNumber: `LIVE-${suffix}`,
        status: "SERVED",
        totalMinor: 20_000,
        createdByMembershipId: membershipId,
        items: {
          create: {
            menuItemId: itemId,
            itemNameSnapshot: "Live browser meal",
            quantity: 1,
            unitPriceMinor: 20_000,
            lineTotalMinor: 20_000,
            status: "SERVED",
          },
        },
      },
    });

    const authService = new AuthService(
      new PrismaAuthRepository(prisma),
      passwordHasher,
      60 * 60 * 1000,
    );
    const cookieOptions = { secure: false, maxAgeMs: 60 * 60 * 1000 };
    const app = createApp({
      allowedOrigins: ["http://127.0.0.1:3100"],
      authService,
      cookieOptions,
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
      billingService: new BillingService(new PrismaBillingRepository(prisma)),
      tableService: new TableService(
        new PrismaTableRepository(prisma),
        "http://127.0.0.1:3100",
      ),
    });
    const server = createServer(app);
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject);
      server.listen(liveApiPort, liveApi.hostname, () => resolve());
    });
    httpServer = server;
  });

  test.afterAll(async () => {
    if (httpServer?.listening)
      await new Promise<void>((resolve) => httpServer!.close(() => resolve()));
    await prisma.paymentIdempotency.deleteMany({ where: { restaurantId } });
    await prisma.payment.deleteMany({ where: { restaurantId } });
    await prisma.billItemModifier.deleteMany({ where: { restaurantId } });
    await prisma.billItem.deleteMany({ where: { restaurantId } });
    await prisma.bill.deleteMany({ where: { restaurantId } });
    await prisma.orderItemModifier.deleteMany({
      where: { orderItem: { restaurantId } },
    });
    await prisma.orderItemStatusHistory.deleteMany({ where: { restaurantId } });
    await prisma.orderStatusHistory.deleteMany({ where: { restaurantId } });
    await prisma.orderItem.deleteMany({ where: { restaurantId } });
    await prisma.order.deleteMany({ where: { restaurantId } });
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

  test("finalizes, pays, prints receipt data, and closes a real PostgreSQL session", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Work email").fill(email);
    await page.getByLabel("Password").fill(password);
    await page.getByRole("button", { name: "Continue" }).click();
    await expect(page).toHaveURL(/\/cashier$/);
    await page.getByRole("button", { name: /Live billing table/ }).click();
    await expect(page.getByText("Live browser meal")).toBeVisible();
    await page.getByRole("button", { name: "Finalize immutable bill" }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Finalize bill" })
      .click();
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Record cash payment" }).click();
    await expect(page.getByText("Paid").first()).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Recorded payments" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Close table" }).click();
    await expect(page.getByText("Paid table session closed.")).toBeVisible();

    const storedBill = await prisma.bill.findUniqueOrThrow({
      where: { tableSessionId },
      include: { payments: true, items: true },
    });
    expect(storedBill.status).toBe("PAID");
    expect(storedBill.totalMinor).toBe(21_000);
    expect(storedBill.payments).toHaveLength(1);
    expect(storedBill.items[0]?.itemNameSnapshot).toBe("Live browser meal");
    expect(
      (
        await prisma.tableSession.findUniqueOrThrow({
          where: { id: tableSessionId },
        })
      ).status,
    ).toBe("CLOSED");
  });
});
