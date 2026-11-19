import "dotenv/config";

import { randomUUID } from "node:crypto";

import {
  billPreviewResponseSchema,
  billResponseSchema,
  errorResponseSchema,
  paymentResponseSchema,
  type AuthenticatedUser,
  type Role,
} from "@restroflow/contracts";
import pino from "pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { createPrismaClient } from "../../lib/prisma.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import { PrismaTableRepository } from "../tables/table.repository.js";
import { TableService } from "../tables/table.service.js";
import { PrismaOrderRepository } from "../orders/order.repository.js";
import { OrderService } from "../orders/order.service.js";
import { PrismaBillingRepository } from "./billing.repository.js";
import {
  BillingService,
  type BillingRealtimePublisher,
} from "./billing.service.js";

const databaseUrl = process.env.DATABASE_URL;
const run = databaseUrl ? describe : describe.skip;

run("billing and payments API against PostgreSQL", () => {
  const prisma = createPrismaClient(databaseUrl!);
  const suffix = randomUUID().slice(0, 8);
  const restaurantId = randomUUID();
  const otherRestaurantId = randomUUID();
  const userId = randomUUID();
  const membershipId = randomUUID();
  const otherMembershipId = randomUUID();
  const tableId = randomUUID();
  const categoryId = randomUUID();
  const menuItemId = randomUUID();
  const limeItemId = randomUUID();
  const modifierGroupId = randomUUID();
  const modifierId = randomUUID();
  let tableSessionId = "";
  const published: Parameters<BillingRealtimePublisher["billChanged"]>[0][] =
    [];

  function authService(role: Role, scope = restaurantId): AuthServiceContract {
    const scopedMembershipId =
      scope === restaurantId ? membershipId : otherMembershipId;
    const user: AuthenticatedUser = {
      id: userId,
      email: `billing-${suffix}@example.test`,
      displayName: "Billing Test Staff",
      memberships: [
        { restaurantId: scope, restaurantName: "Billing Test", role },
      ],
    };
    return {
      login: () => Promise.reject(new Error("unused")),
      logout: () => Promise.resolve(),
      authenticate: () =>
        Promise.resolve({
          user,
          sessionTokenHash: "test-hash",
          membershipIds: { [scope]: scopedMembershipId },
        }),
    };
  }

  function app(role: Role = "CASHIER", scope = restaurantId) {
    const auth = authService(role, scope);
    const publisher: BillingRealtimePublisher = {
      billChanged: (event) => {
        published.push(event);
        return Promise.resolve();
      },
    };
    return createApp({
      allowedOrigins: ["http://localhost:3000"],
      authService: auth,
      cookieOptions: { secure: false, maxAgeMs: 60_000 },
      healthRepository: { isDatabaseAvailable: () => Promise.resolve(true) },
      loginRateLimitMax: 50,
      logger: pino({ enabled: false }),
      restaurantService: {
        get: () => Promise.reject(new Error("unused")),
        update: () => Promise.reject(new Error("unused")),
      },
      staffService: {
        list: () => Promise.reject(new Error("unused")),
        create: () => Promise.reject(new Error("unused")),
        update: () => Promise.reject(new Error("unused")),
      },
      billingService: new BillingService(
        new PrismaBillingRepository(prisma),
        publisher,
      ),
      tableService: new TableService(
        new PrismaTableRepository(prisma),
        "http://localhost:3000",
      ),
    });
  }

  async function cleanTransactionalData() {
    await prisma.paymentIdempotency.deleteMany({ where: { restaurantId } });
    await prisma.payment.deleteMany({ where: { restaurantId } });
    await prisma.billItemModifier.deleteMany({
      where: { restaurantId },
    });
    await prisma.billItem.deleteMany({ where: { restaurantId } });
    await prisma.bill.deleteMany({ where: { restaurantId } });
    await prisma.orderItemModifier.deleteMany({
      where: { orderItem: { restaurantId } },
    });
    await prisma.orderItemStatusHistory.deleteMany({ where: { restaurantId } });
    await prisma.orderStatusHistory.deleteMany({ where: { restaurantId } });
    await prisma.orderItem.deleteMany({ where: { restaurantId } });
    await prisma.order.deleteMany({ where: { restaurantId } });
    await prisma.tableSession.deleteMany({ where: { restaurantId } });
  }

  async function createServedOrder() {
    await prisma.order.create({
      data: {
        restaurantId,
        tableSessionId,
        orderNumber: `ORD-${randomUUID().slice(0, 8)}`,
        status: "SERVED",
        totalMinor: 27_000,
        createdByMembershipId: membershipId,
        items: {
          create: [
            {
              menuItemId,
              itemNameSnapshot: "Chicken biryani",
              quantity: 1,
              unitPriceMinor: 18_000,
              lineTotalMinor: 22_000,
              status: "SERVED",
              modifiers: {
                create: {
                  modifierGroupId,
                  modifierId,
                  modifierGroupNameSnapshot: "Extras",
                  modifierNameSnapshot: "Extra chicken",
                  modifierPriceMinor: 4_000,
                  quantity: 1,
                },
              },
            },
            {
              menuItemId: limeItemId,
              itemNameSnapshot: "Fresh lime",
              quantity: 1,
              unitPriceMinor: 5_000,
              lineTotalMinor: 5_000,
              status: "SERVED",
              batchNumber: 2,
            },
            {
              menuItemId: limeItemId,
              itemNameSnapshot: "Cancelled dessert",
              quantity: 1,
              unitPriceMinor: 1_000,
              lineTotalMinor: 1_000,
              status: "CANCELLED",
              batchNumber: 2,
            },
          ],
        },
      },
    });
  }

  async function finalize() {
    const response = await request(app())
      .post(`/api/v1/table-sessions/${tableSessionId}/bills`)
      .set("x-restaurant-id", restaurantId)
      .expect(201);
    return billResponseSchema.parse(response.body).bill;
  }

  beforeAll(async () => {
    await prisma.restaurant.createMany({
      data: [
        {
          id: restaurantId,
          name: `Billing Test ${suffix}`,
          slug: `billing-test-${suffix}`,
          address: "1 Test Street",
          currency: "INR",
          taxName: "GST",
          taxRateBasisPoints: 500,
        },
        {
          id: otherRestaurantId,
          name: `Other Billing ${suffix}`,
          slug: `other-billing-${suffix}`,
        },
      ],
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `billing-${suffix}@example.test`,
        displayName: "Billing Test Staff",
        passwordHash: "unused",
      },
    });
    await prisma.staffMembership.createMany({
      data: [
        { id: membershipId, restaurantId, userId, role: "CASHIER" },
        {
          id: otherMembershipId,
          restaurantId: otherRestaurantId,
          userId,
          role: "CASHIER",
        },
      ],
    });
    await prisma.restaurantTable.create({
      data: {
        id: tableId,
        restaurantId,
        tableNumber: `B-${suffix}`,
        displayName: "Billing table",
        capacity: 4,
        qrIdentifier: randomUUID().replaceAll("-", ""),
      },
    });
    await prisma.menuCategory.create({
      data: {
        id: categoryId,
        restaurantId,
        name: `Billing menu ${suffix}`,
      },
    });
    await prisma.menuItem.createMany({
      data: [
        {
          id: menuItemId,
          restaurantId,
          categoryId,
          name: "Current biryani name",
          priceMinor: 99_999,
        },
        {
          id: limeItemId,
          restaurantId,
          categoryId,
          name: "Current lime name",
          priceMinor: 99_999,
        },
      ],
    });
    await prisma.modifierGroup.create({
      data: {
        id: modifierGroupId,
        restaurantId,
        name: `Extras ${suffix}`,
        maxSelections: 2,
      },
    });
    await prisma.modifier.create({
      data: {
        id: modifierId,
        modifierGroupId,
        name: "Current extra name",
        priceDeltaMinor: 99_999,
      },
    });
  });

  beforeEach(async () => {
    published.length = 0;
    await cleanTransactionalData();
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { taxRateBasisPoints: 500, pricesIncludeTax: false },
    });
    tableSessionId = randomUUID();
    await prisma.tableSession.create({
      data: {
        id: tableSessionId,
        restaurantId,
        tableId,
        openedByMembershipId: membershipId,
      },
    });
    await createServedOrder();
  });

  afterAll(async () => {
    await cleanTransactionalData();
    await prisma.modifier.deleteMany({ where: { modifierGroupId } });
    await prisma.modifierGroup.deleteMany({ where: { restaurantId } });
    await prisma.menuItem.deleteMany({ where: { restaurantId } });
    await prisma.menuCategory.deleteMany({ where: { restaurantId } });
    await prisma.restaurantTable.deleteMany({ where: { restaurantId } });
    await prisma.staffMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.restaurant.deleteMany({
      where: { id: { in: [restaurantId, otherRestaurantId] } },
    });
    await prisma.$disconnect();
  });

  it("previews and finalizes immutable order snapshots with line-rounded tax", async () => {
    const previewResponse = await request(app())
      .get(`/api/v1/table-sessions/${tableSessionId}/bill-preview`)
      .set("x-restaurant-id", restaurantId)
      .expect(200);
    const preview = billPreviewResponseSchema.parse(
      previewResponse.body,
    ).preview;
    expect(preview).toMatchObject({
      subtotalMinor: 27_000,
      taxMinor: 1_350,
      totalMinor: 28_350,
      canFinalize: true,
      taxRateBasisPoints: 500,
      roundingPolicy: "PER_LINE_HALF_UP_V1",
    });
    expect(preview.items.map((item) => item.itemNameSnapshot)).toEqual([
      "Chicken biryani",
      "Fresh lime",
    ]);
    expect(preview.items[0]?.modifiers[0]?.modifierNameSnapshot).toBe(
      "Extra chicken",
    );

    const bill = await finalize();
    expect(bill.totalMinor).toBe(28_350);
    expect(bill.items[0]?.itemNameSnapshot).toBe("Chicken biryani");
    expect(published).toHaveLength(1);

    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { taxRateBasisPoints: 1_000 },
    });
    const historical = await request(app())
      .get(`/api/v1/bills/${bill.id}/receipt`)
      .set("x-restaurant-id", restaurantId)
      .expect(200);
    expect(billResponseSchema.parse(historical.body).bill).toMatchObject({
      taxRateBasisPoints: 500,
      taxMinor: 1_350,
      totalMinor: 28_350,
    });

    const duplicate = await request(app())
      .post(`/api/v1/table-sessions/${tableSessionId}/bills`)
      .set("x-restaurant-id", restaurantId)
      .expect(409);
    expect(errorResponseSchema.parse(duplicate.body).error.code).toBe(
      "BILL_ALREADY_FINALIZED",
    );
  });

  it("serializes concurrent finalization and new-order submission", async () => {
    const billing = new BillingService(new PrismaBillingRepository(prisma));
    const orders = new OrderService(new PrismaOrderRepository(prisma));
    const results = await Promise.allSettled([
      billing.finalize(restaurantId, membershipId, tableSessionId),
      orders.createOrder(restaurantId, membershipId, `race-${randomUUID()}`, {
        tableSessionId,
        items: [{ menuItemId: limeItemId, quantity: 1, modifierIds: [] }],
      }),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === "rejected"),
    ).toHaveLength(1);
  });

  it("creates one bill under concurrent finalization", async () => {
    const responses = await Promise.all([
      request(app())
        .post(`/api/v1/table-sessions/${tableSessionId}/bills`)
        .set("x-restaurant-id", restaurantId),
      request(app())
        .post(`/api/v1/table-sessions/${tableSessionId}/bills`)
        .set("x-restaurant-id", restaurantId),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    expect(await prisma.bill.count({ where: { tableSessionId } })).toBe(1);
  });

  it("blocks finalization while any order is unresolved", async () => {
    await prisma.order.create({
      data: {
        restaurantId,
        tableSessionId,
        orderNumber: `PENDING-${randomUUID().slice(0, 6)}`,
        status: "PENDING",
        totalMinor: 0,
        createdByMembershipId: membershipId,
      },
    });
    const previewResponse = await request(app())
      .get(`/api/v1/table-sessions/${tableSessionId}/bill-preview`)
      .set("x-restaurant-id", restaurantId)
      .expect(200);
    expect(
      billPreviewResponseSchema.parse(previewResponse.body).preview,
    ).toMatchObject({ canFinalize: false, blockingOrderCount: 1 });
    const response = await request(app())
      .post(`/api/v1/table-sessions/${tableSessionId}/bills`)
      .set("x-restaurant-id", restaurantId)
      .expect(409);
    expect(errorResponseSchema.parse(response.body).error.code).toBe(
      "BILL_HAS_UNRESOLVED_ORDERS",
    );
  });

  it("records partial payments idempotently and prevents concurrent overpayment", async () => {
    const bill = await finalize();
    const partialBody = {
      amountMinor: 10_000,
      method: "CASH",
      receivedExternally: true,
    } as const;
    const first = await request(app())
      .post(`/api/v1/bills/${bill.id}/payments`)
      .set("x-restaurant-id", restaurantId)
      .set("idempotency-key", "partial-payment-key")
      .send(partialBody)
      .expect(201);
    const partial = paymentResponseSchema.parse(first.body);
    expect(partial.bill).toMatchObject({
      status: "PARTIALLY_PAID",
      amountPaidMinor: 10_000,
      outstandingMinor: 18_350,
    });

    const replay = await request(app())
      .post(`/api/v1/bills/${bill.id}/payments`)
      .set("x-restaurant-id", restaurantId)
      .set("idempotency-key", "partial-payment-key")
      .send(partialBody)
      .expect(201);
    expect(replay.body).toEqual(first.body);
    expect(await prisma.payment.count({ where: { billId: bill.id } })).toBe(1);

    const conflict = await request(app())
      .post(`/api/v1/bills/${bill.id}/payments`)
      .set("x-restaurant-id", restaurantId)
      .set("idempotency-key", "partial-payment-key")
      .send({ ...partialBody, amountMinor: 10_001 })
      .expect(409);
    expect(errorResponseSchema.parse(conflict.body).error.code).toBe(
      "IDEMPOTENCY_KEY_REUSED",
    );

    const competing = await Promise.all([
      request(app())
        .post(`/api/v1/bills/${bill.id}/payments`)
        .set("x-restaurant-id", restaurantId)
        .set("idempotency-key", "final-a-key")
        .send({
          amountMinor: 18_350,
          method: "UPI",
          reference: "manual-confirmation",
          receivedExternally: true,
        }),
      request(app())
        .post(`/api/v1/bills/${bill.id}/payments`)
        .set("x-restaurant-id", restaurantId)
        .set("idempotency-key", "final-b-key")
        .send({
          amountMinor: 18_350,
          method: "CASH",
          receivedExternally: true,
        }),
    ]);
    expect(competing.map((response) => response.status).sort()).toEqual([
      201, 409,
    ]);
    const payments = await prisma.payment.findMany({
      where: { billId: bill.id },
    });
    expect(
      payments.reduce((sum, payment) => sum + payment.amountMinor, 0),
    ).toBe(28_350);
    expect(
      (await prisma.bill.findUniqueOrThrow({ where: { id: bill.id } })).status,
    ).toBe("PAID");
  });

  it("enforces roles, restaurant isolation, and paid-session closure", async () => {
    const waiterFinalize = await request(app("WAITER"))
      .post(`/api/v1/table-sessions/${tableSessionId}/bills`)
      .set("x-restaurant-id", restaurantId)
      .expect(403);
    expect(errorResponseSchema.parse(waiterFinalize.body).error.code).toBe(
      "ROLE_FORBIDDEN",
    );
    const bill = await finalize();
    await request(app())
      .post(`/api/v1/table-sessions/${tableSessionId}/close`)
      .set("x-restaurant-id", restaurantId)
      .expect(409);
    await request(app("CASHIER", otherRestaurantId))
      .get(`/api/v1/bills/${bill.id}`)
      .set("x-restaurant-id", otherRestaurantId)
      .expect(404);
    await request(app("WAITER"))
      .post(`/api/v1/bills/${bill.id}/payments`)
      .set("x-restaurant-id", restaurantId)
      .set("idempotency-key", "waiter-payment-key")
      .send({
        amountMinor: bill.totalMinor,
        method: "CASH",
        receivedExternally: true,
      })
      .expect(403);
    await request(app())
      .post(`/api/v1/bills/${bill.id}/payments`)
      .set("x-restaurant-id", restaurantId)
      .set("idempotency-key", "full-payment-key")
      .send({
        amountMinor: bill.totalMinor,
        method: "CASH",
        receivedExternally: true,
      })
      .expect(201);
    await request(app())
      .post(`/api/v1/table-sessions/${tableSessionId}/close`)
      .set("x-restaurant-id", restaurantId)
      .expect(200);
  });
});
