import "dotenv/config";

import { randomUUID } from "node:crypto";

import {
  analyticsOverviewResponseSchema,
  kitchenAnalyticsResponseSchema,
  orderAnalyticsResponseSchema,
  paymentAnalyticsResponseSchema,
  popularItemsAnalyticsResponseSchema,
  salesAnalyticsResponseSchema,
  tableAnalyticsResponseSchema,
  type AuthenticatedUser,
  type Role,
} from "@restroflow/contracts";
import pino from "pino";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { createPrismaClient } from "../../lib/prisma.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import { PrismaAnalyticsRepository } from "./analytics.repository.js";
import { AnalyticsService } from "./analytics.service.js";

const databaseUrl = process.env.DATABASE_URL;
const run = databaseUrl ? describe : describe.skip;

run("analytics API against PostgreSQL", () => {
  const prisma = createPrismaClient(databaseUrl!);
  const suffix = randomUUID().slice(0, 8);
  const restaurantId = randomUUID();
  const otherRestaurantId = randomUUID();
  const userId = randomUUID();
  const membershipId = randomUUID();
  const otherMembershipId = randomUUID();
  const categoryId = randomUUID();
  const menuItemId = randomUUID();
  const firstTableId = randomUUID();
  const secondTableId = randomUUID();
  const firstSessionId = randomUUID();
  const secondSessionId = randomUUID();
  const servedOrderId = randomUUID();
  const cancelledOrderId = randomUUID();
  const servedItemId = randomUUID();
  const cancelledItemId = randomUUID();
  const firstBillId = randomUUID();
  const secondBillId = randomUUID();
  const dstTableId = randomUUID();
  const dstSessionId = randomUUID();
  const dstBillId = randomUUID();

  function authService(
    role: Role = "ADMIN",
    scope = restaurantId,
  ): AuthServiceContract {
    const scopedMembership =
      scope === restaurantId ? membershipId : otherMembershipId;
    const user: AuthenticatedUser = {
      id: userId,
      email: `analytics-${suffix}@example.test`,
      displayName: "Analytics Test Staff",
      memberships: [
        { restaurantId: scope, restaurantName: "Analytics Test", role },
      ],
    };
    return {
      login: () => Promise.reject(new Error("unused")),
      logout: () => Promise.resolve(),
      authenticate: () =>
        Promise.resolve({
          user,
          sessionTokenHash: "test",
          membershipIds: { [scope]: scopedMembership },
        }),
    };
  }

  function app(scope = restaurantId) {
    const unused = () => Promise.reject(new Error("unused"));
    return createApp({
      allowedOrigins: ["http://localhost:3000"],
      authService: authService("ADMIN", scope),
      cookieOptions: { secure: false, maxAgeMs: 60_000 },
      healthRepository: { isDatabaseAvailable: () => Promise.resolve(true) },
      loginRateLimitMax: 50,
      logger: pino({ enabled: false }),
      restaurantService: { get: unused, update: unused },
      staffService: { list: unused, create: unused, update: unused },
      analyticsService: new AnalyticsService(
        new PrismaAnalyticsRepository(prisma),
      ),
    });
  }

  const query = "startDate=2026-11-20&endDate=2026-11-21&granularity=day";

  beforeAll(async () => {
    await prisma.restaurant.createMany({
      data: [
        {
          id: restaurantId,
          name: `Analytics ${suffix}`,
          slug: `analytics-${suffix}`,
          timezone: "Asia/Kolkata",
          currency: "INR",
        },
        {
          id: otherRestaurantId,
          name: `Other analytics ${suffix}`,
          slug: `other-analytics-${suffix}`,
          timezone: "America/New_York",
          currency: "USD",
        },
      ],
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `analytics-${suffix}@example.test`,
        displayName: "Analytics Test Staff",
        passwordHash: "unused",
      },
    });
    await prisma.staffMembership.createMany({
      data: [
        { id: membershipId, userId, restaurantId, role: "ADMIN" },
        {
          id: otherMembershipId,
          userId,
          restaurantId: otherRestaurantId,
          role: "ADMIN",
        },
      ],
    });
    await prisma.menuCategory.create({
      data: {
        id: categoryId,
        restaurantId,
        name: `Analytics category ${suffix}`,
      },
    });
    await prisma.menuItem.create({
      data: {
        id: menuItemId,
        restaurantId,
        categoryId,
        name: "Current renamed dish",
        priceMinor: 10_000,
        isActive: false,
      },
    });
    await prisma.restaurantTable.createMany({
      data: [
        {
          id: firstTableId,
          restaurantId,
          tableNumber: `A-${suffix}`,
          displayName: "Window table",
          capacity: 4,
          qrIdentifier: randomUUID().replaceAll("-", ""),
        },
        {
          id: secondTableId,
          restaurantId,
          tableNumber: `B-${suffix}`,
          displayName: "Garden table",
          capacity: 4,
          qrIdentifier: randomUUID().replaceAll("-", ""),
        },
        {
          id: dstTableId,
          restaurantId: otherRestaurantId,
          tableNumber: `DST-${suffix}`,
          displayName: "DST table",
          capacity: 2,
          qrIdentifier: randomUUID().replaceAll("-", ""),
        },
      ],
    });
    await prisma.tableSession.createMany({
      data: [
        {
          id: firstSessionId,
          restaurantId,
          tableId: firstTableId,
          status: "OPEN",
          openedAt: new Date("2026-11-19T18:35:00.000Z"),
          openedByMembershipId: membershipId,
        },
        {
          id: secondSessionId,
          restaurantId,
          tableId: secondTableId,
          status: "CLOSED",
          openedAt: new Date("2026-11-20T15:30:00.000Z"),
          closedAt: new Date("2026-11-20T17:00:00.000Z"),
          openedByMembershipId: membershipId,
          closedByMembershipId: membershipId,
        },
      ],
    });
    await prisma.tableSession.create({
      data: {
        id: dstSessionId,
        restaurantId: otherRestaurantId,
        tableId: dstTableId,
        status: "OPEN",
        openedAt: new Date("2026-11-02T04:00:00.000Z"),
        openedByMembershipId: otherMembershipId,
      },
    });
    await prisma.order.createMany({
      data: [
        {
          id: servedOrderId,
          restaurantId,
          tableSessionId: firstSessionId,
          orderNumber: `S-${suffix}`,
          status: "SERVED",
          totalMinor: 10_000,
          createdByMembershipId: membershipId,
          createdAt: new Date("2026-11-19T18:40:00.000Z"),
        },
        {
          id: cancelledOrderId,
          restaurantId,
          tableSessionId: secondSessionId,
          orderNumber: `C-${suffix}`,
          status: "CANCELLED",
          totalMinor: 20_000,
          createdByMembershipId: membershipId,
          createdAt: new Date("2026-11-20T16:00:00.000Z"),
        },
      ],
    });
    await prisma.orderItem.createMany({
      data: [
        {
          id: servedItemId,
          orderId: servedOrderId,
          restaurantId,
          menuItemId,
          itemNameSnapshot: "Historical special",
          quantity: 2,
          unitPriceMinor: 5_000,
          lineTotalMinor: 10_000,
          status: "SERVED",
        },
        {
          id: cancelledItemId,
          orderId: cancelledOrderId,
          restaurantId,
          menuItemId,
          itemNameSnapshot: "Historical special",
          quantity: 1,
          unitPriceMinor: 20_000,
          lineTotalMinor: 20_000,
          status: "CANCELLED",
        },
      ],
    });
    await prisma.orderStatusHistory.createMany({
      data: [
        {
          orderId: servedOrderId,
          restaurantId,
          newStatus: "PENDING",
          actorMembershipId: membershipId,
          createdAt: new Date("2026-11-19T18:40:00.000Z"),
        },
        {
          orderId: servedOrderId,
          restaurantId,
          previousStatus: "READY",
          newStatus: "SERVED",
          actorMembershipId: membershipId,
          createdAt: new Date("2026-11-19T19:00:00.000Z"),
        },
        {
          orderId: cancelledOrderId,
          restaurantId,
          newStatus: "PENDING",
          actorMembershipId: membershipId,
          createdAt: new Date("2026-11-20T16:00:00.000Z"),
        },
        {
          orderId: cancelledOrderId,
          restaurantId,
          previousStatus: "PENDING",
          newStatus: "CANCELLED",
          actorMembershipId: membershipId,
          createdAt: new Date("2026-11-20T16:05:00.000Z"),
        },
      ],
    });
    await prisma.orderItemStatusHistory.createMany({
      data: [
        {
          orderItemId: servedItemId,
          restaurantId,
          newStatus: "PENDING",
          actorMembershipId: membershipId,
          createdAt: new Date("2026-11-19T18:40:00.000Z"),
        },
        {
          orderItemId: servedItemId,
          restaurantId,
          previousStatus: "PENDING",
          newStatus: "PREPARING",
          actorMembershipId: membershipId,
          createdAt: new Date("2026-11-19T18:45:00.000Z"),
        },
        {
          orderItemId: servedItemId,
          restaurantId,
          previousStatus: "PREPARING",
          newStatus: "READY",
          actorMembershipId: membershipId,
          createdAt: new Date("2026-11-19T18:55:00.000Z"),
        },
      ],
    });
    await prisma.bill.createMany({
      data: [
        {
          id: firstBillId,
          restaurantId,
          tableSessionId: firstSessionId,
          billNumber: `A-${suffix}`,
          status: "PARTIALLY_PAID",
          currency: "INR",
          taxName: "Tax",
          taxRateBasisPoints: 0,
          pricesIncludeTax: false,
          roundingPolicy: "PER_LINE_HALF_UP_V1",
          subtotalMinor: 10_000,
          taxMinor: 0,
          totalMinor: 10_000,
          amountPaidMinor: 4_000,
          createdByMembershipId: membershipId,
          finalizedByMembershipId: membershipId,
          finalizedAt: new Date("2026-11-19T18:40:00.000Z"),
          createdAt: new Date("2026-11-19T18:40:00.000Z"),
        },
        {
          id: secondBillId,
          restaurantId,
          tableSessionId: secondSessionId,
          billNumber: `B-${suffix}`,
          status: "PAID",
          currency: "INR",
          taxName: "Tax",
          taxRateBasisPoints: 0,
          pricesIncludeTax: false,
          roundingPolicy: "PER_LINE_HALF_UP_V1",
          subtotalMinor: 20_000,
          taxMinor: 0,
          totalMinor: 20_000,
          amountPaidMinor: 20_000,
          createdByMembershipId: membershipId,
          finalizedByMembershipId: membershipId,
          finalizedAt: new Date("2026-11-20T17:00:00.000Z"),
          createdAt: new Date("2026-11-20T17:00:00.000Z"),
        },
      ],
    });
    await prisma.bill.create({
      data: {
        id: dstBillId,
        restaurantId: otherRestaurantId,
        tableSessionId: dstSessionId,
        billNumber: `DST-${suffix}`,
        status: "FINALIZED",
        currency: "USD",
        taxName: "Tax",
        taxRateBasisPoints: 0,
        pricesIncludeTax: false,
        roundingPolicy: "PER_LINE_HALF_UP_V1",
        subtotalMinor: 5_000,
        taxMinor: 0,
        totalMinor: 5_000,
        amountPaidMinor: 0,
        createdByMembershipId: otherMembershipId,
        finalizedByMembershipId: otherMembershipId,
        finalizedAt: new Date("2026-11-02T04:30:00.000Z"),
        createdAt: new Date("2026-11-02T04:30:00.000Z"),
      },
    });
    await prisma.billItem.create({
      data: {
        restaurantId,
        billId: firstBillId,
        sourceOrderItemId: servedItemId,
        orderNumberSnapshot: `S-${suffix}`,
        itemNameSnapshot: "Historical special",
        quantity: 2,
        unitPriceMinor: 5_000,
        modifierSubtotalMinor: 0,
        lineSubtotalMinor: 10_000,
        taxAmountMinor: 0,
        finalLineAmountMinor: 10_000,
        batchNumber: 1,
      },
    });
    await prisma.payment.createMany({
      data: [
        {
          restaurantId,
          billId: firstBillId,
          amountMinor: 4_000,
          method: "CASH",
          recordedByMembershipId: membershipId,
          recordedAt: new Date("2026-11-20T19:00:00.000Z"),
        },
        {
          restaurantId,
          billId: secondBillId,
          amountMinor: 20_000,
          method: "UPI",
          recordedByMembershipId: membershipId,
          recordedAt: new Date("2026-11-20T17:05:00.000Z"),
        },
      ],
    });
  });

  afterAll(async () => {
    await prisma.payment.deleteMany({ where: { restaurantId } });
    await prisma.billItem.deleteMany({ where: { restaurantId } });
    await prisma.bill.deleteMany({
      where: { restaurantId: { in: [restaurantId, otherRestaurantId] } },
    });
    await prisma.orderItemStatusHistory.deleteMany({ where: { restaurantId } });
    await prisma.orderStatusHistory.deleteMany({ where: { restaurantId } });
    await prisma.orderItem.deleteMany({ where: { restaurantId } });
    await prisma.order.deleteMany({ where: { restaurantId } });
    await prisma.tableSession.deleteMany({
      where: { restaurantId: { in: [restaurantId, otherRestaurantId] } },
    });
    await prisma.restaurantTable.deleteMany({
      where: { restaurantId: { in: [restaurantId, otherRestaurantId] } },
    });
    await prisma.menuItem.deleteMany({ where: { restaurantId } });
    await prisma.menuCategory.deleteMany({ where: { restaurantId } });
    await prisma.staffMembership.deleteMany({ where: { userId } });
    await prisma.user.delete({ where: { id: userId } });
    await prisma.restaurant.deleteMany({
      where: { id: { in: [restaurantId, otherRestaurantId] } },
    });
    await prisma.$disconnect();
  });

  it("separates sales, payments, outstanding, and local-midnight boundaries", async () => {
    const response = await request(app())
      .get(`/api/v1/analytics/overview?${query}`)
      .set("x-restaurant-id", restaurantId)
      .expect(200);
    const result = analyticsOverviewResponseSchema.parse(
      response.body,
    ).overview;
    expect(result.finalizedSales.value).toBe("30000");
    expect(result.recordedPayments.value).toBe("20000");
    expect(result.currentOutstandingMinor).toBe("6000");
    expect(result.periodOutstandingMinor).toBe("6000");
    expect(result.completedOrderCount.value).toBe(1);
    expect(result.context.timezone).toBe("Asia/Kolkata");
  });

  it("returns deterministic sales, payment, item, and order reports", async () => {
    const [salesResponse, paymentResponse, itemsResponse, orderResponse] =
      await Promise.all([
        request(app())
          .get(`/api/v1/analytics/sales?${query}`)
          .set("x-restaurant-id", restaurantId),
        request(app())
          .get(`/api/v1/analytics/payments?${query}`)
          .set("x-restaurant-id", restaurantId),
        request(app())
          .get(`/api/v1/analytics/popular-items?${query}&limit=5`)
          .set("x-restaurant-id", restaurantId),
        request(app())
          .get(`/api/v1/analytics/orders?${query}`)
          .set("x-restaurant-id", restaurantId),
      ]);
    const sales = salesAnalyticsResponseSchema.parse(salesResponse.body).sales;
    const payments = paymentAnalyticsResponseSchema.parse(
      paymentResponse.body,
    ).payments;
    const items = popularItemsAnalyticsResponseSchema.parse(
      itemsResponse.body,
    ).popularItems;
    const orders = orderAnalyticsResponseSchema.parse(
      orderResponse.body,
    ).orders;
    expect(sales.points).toEqual([
      { period: "2026-11-20", amountMinor: "30000", count: 2 },
    ]);
    expect(payments.methods).toEqual([
      { method: "UPI", amountMinor: "20000", paymentCount: 1 },
    ]);
    expect(items.items[0]).toMatchObject({
      menuItemId,
      itemName: "Historical special",
      quantitySold: 2,
      salesContributionMinor: "10000",
    });
    expect(orders).toMatchObject({
      ordersCreated: 2,
      ordersServed: 1,
      ordersCancelled: 1,
      ordersRejected: 0,
      sourceBreakdown: { waiter: 2, customer: 0 },
    });
  });

  it("calculates actual session and item-transition durations", async () => {
    const [tableResponse, kitchenResponse] = await Promise.all([
      request(app())
        .get(`/api/v1/analytics/tables?${query}`)
        .set("x-restaurant-id", restaurantId),
      request(app())
        .get(`/api/v1/analytics/kitchen?${query}`)
        .set("x-restaurant-id", restaurantId),
    ]);
    const tables = tableAnalyticsResponseSchema.parse(
      tableResponse.body,
    ).tables;
    const kitchen = kitchenAnalyticsResponseSchema.parse(
      kitchenResponse.body,
    ).kitchen;
    expect(tables).toMatchObject({
      activeTables: 2,
      currentlyOccupiedTables: 1,
      availableTables: 1,
      completedSessions: 1,
      averageOccupiedDurationMinutes: 90,
    });
    expect(kitchen).toMatchObject({
      averageQueueToPreparingMinutes: 5,
      averagePreparationMinutes: 10,
      averageTotalToReadyMinutes: 15,
      completedItemSamples: 1,
    });
  });

  it("does not leak another restaurant's analytics", async () => {
    const response = await request(app(otherRestaurantId))
      .get(`/api/v1/analytics/overview?${query}`)
      .set("x-restaurant-id", otherRestaurantId)
      .expect(200);
    const result = analyticsOverviewResponseSchema.parse(
      response.body,
    ).overview;
    expect(result.finalizedSales.value).toBe("0");
    expect(result.recordedPayments.value).toBe("0");
    expect(result.finalizedBillCount.value).toBe(0);
  });

  it("uses a 25-hour local day across the daylight-saving fall-back", async () => {
    const response = await request(app(otherRestaurantId))
      .get(
        "/api/v1/analytics/sales?startDate=2026-11-01&endDate=2026-11-02&granularity=day",
      )
      .set("x-restaurant-id", otherRestaurantId)
      .expect(200);
    const result = salesAnalyticsResponseSchema.parse(response.body).sales;
    expect(result.context.timezone).toBe("America/New_York");
    expect(result.points).toEqual([
      { period: "2026-11-01", amountMinor: "5000", count: 1 },
    ]);
  });
});
