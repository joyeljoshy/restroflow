import "dotenv/config";

import { randomUUID } from "node:crypto";

import type { AuthenticatedUser, Role } from "@restroflow/contracts";
import {
  errorResponseSchema,
  kitchenTicketListResponseSchema,
  orderHistoryResponseSchema,
  orderListResponseSchema,
  orderResponseSchema,
} from "@restroflow/contracts";
import pino from "pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { createPrismaClient } from "../../lib/prisma.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import { PrismaOrderRepository } from "./order.repository.js";
import { OrderService } from "./order.service.js";
import type { RealtimePublisher } from "../realtime/realtime.publisher.js";
import { PrismaTableRepository } from "../tables/table.repository.js";
import { TableService } from "../tables/table.service.js";

const databaseUrl = process.env.DATABASE_URL;
const run = databaseUrl ? describe : describe.skip;

run("transactional order API against PostgreSQL", () => {
  const prisma = createPrismaClient(databaseUrl!);
  const suffix = randomUUID().slice(0, 8);
  const restaurantId = randomUUID();
  const otherRestaurantId = randomUUID();
  const userId = randomUUID();
  const membershipId = randomUUID();
  const tableId = randomUUID();
  const categoryId = randomUUID();
  const menuItemId = randomUUID();
  const groupId = randomUUID();
  const modifierId = randomUUID();
  let sessionId = "";

  function authService(role: Role, scope = restaurantId): AuthServiceContract {
    const user: AuthenticatedUser = {
      id: userId,
      email: `orders-${suffix}@example.test`,
      displayName: "Order Test Staff",
      memberships: [
        { restaurantId: scope, restaurantName: "Order Test", role },
      ],
    };
    return {
      login: () => Promise.reject(new Error("unused")),
      logout: () => Promise.resolve(),
      authenticate: () =>
        Promise.resolve({
          user,
          sessionTokenHash: "test-hash",
          membershipIds: { [scope]: membershipId },
        }),
    };
  }

  function app(
    role: Role = "WAITER",
    scope = restaurantId,
    publisher?: RealtimePublisher,
  ) {
    const orderRepository = new PrismaOrderRepository(prisma);
    return createApp({
      allowedOrigins: ["http://localhost:3000"],
      authService: authService(role, scope),
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
      orderService: new OrderService(orderRepository, publisher),
      tableService: new TableService(
        new PrismaTableRepository(prisma),
        "http://localhost:3000",
      ),
    });
  }

  function orderPayload(quantity = 2) {
    return {
      tableSessionId: sessionId,
      items: [
        {
          menuItemId,
          quantity,
          modifierIds: [modifierId],
          specialInstructions: "No onion",
        },
      ],
    };
  }

  async function submit(key = `order-${randomUUID()}`) {
    const response = await request(app())
      .post("/api/v1/orders")
      .set("idempotency-key", key)
      .send(orderPayload())
      .expect(201);
    return orderResponseSchema.parse(response.body).order;
  }

  async function cleanOrdersAndSessions() {
    await prisma.idempotencyKey.deleteMany({ where: { restaurantId } });
    await prisma.orderItemModifier.deleteMany({
      where: { orderItem: { restaurantId } },
    });
    await prisma.orderItemStatusHistory.deleteMany({
      where: { restaurantId },
    });
    await prisma.orderStatusHistory.deleteMany({ where: { restaurantId } });
    await prisma.orderItem.deleteMany({ where: { restaurantId } });
    await prisma.order.deleteMany({ where: { restaurantId } });
    await prisma.tableSession.deleteMany({ where: { restaurantId } });
  }

  beforeAll(async () => {
    await prisma.restaurant.create({
      data: {
        id: restaurantId,
        name: `Order Test ${suffix}`,
        slug: `order-test-${suffix}`,
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `orders-${suffix}@example.test`,
        displayName: "Order Test Staff",
        passwordHash: "not-used-by-integration-test",
      },
    });
    await prisma.staffMembership.create({
      data: {
        id: membershipId,
        restaurantId,
        userId,
        role: "ADMIN",
      },
    });
    await prisma.restaurantTable.create({
      data: {
        id: tableId,
        restaurantId,
        tableNumber: `IT-${suffix}`,
        displayName: "Integration Table",
        capacity: 4,
        qrIdentifier: randomUUID().replaceAll("-", ""),
      },
    });
    await prisma.menuCategory.create({
      data: {
        id: categoryId,
        restaurantId,
        name: `Mains ${suffix}`,
      },
    });
    await prisma.menuItem.create({
      data: {
        id: menuItemId,
        restaurantId,
        categoryId,
        name: "Paneer Bowl",
        priceMinor: 10_000,
      },
    });
    await prisma.modifierGroup.create({
      data: {
        id: groupId,
        restaurantId,
        name: `Protein ${suffix}`,
        minSelections: 1,
        maxSelections: 2,
      },
    });
    await prisma.modifier.create({
      data: {
        id: modifierId,
        modifierGroupId: groupId,
        name: "Extra paneer",
        priceDeltaMinor: 2_500,
      },
    });
    await prisma.menuItemModifierGroup.create({
      data: { restaurantId, menuItemId, modifierGroupId: groupId },
    });
  });

  beforeEach(async () => {
    await cleanOrdersAndSessions();
    await prisma.menuCategory.update({
      where: { id_restaurantId: { id: categoryId, restaurantId } },
      data: { isActive: true },
    });
    await prisma.menuItem.update({
      where: { id_restaurantId: { id: menuItemId, restaurantId } },
      data: { isActive: true, isAvailable: true, priceMinor: 10_000 },
    });
    await prisma.modifierGroup.update({
      where: { id_restaurantId: { id: groupId, restaurantId } },
      data: { isActive: true, minSelections: 1, maxSelections: 2 },
    });
    await prisma.modifier.update({
      where: { id: modifierId },
      data: { isAvailable: true, priceDeltaMinor: 2_500 },
    });
    sessionId = randomUUID();
    await prisma.tableSession.create({
      data: {
        id: sessionId,
        restaurantId,
        tableId,
        openedByMembershipId: membershipId,
      },
    });
  });

  afterAll(async () => {
    await cleanOrdersAndSessions();
    await prisma.menuItemModifierGroup.deleteMany({ where: { restaurantId } });
    await prisma.modifier.deleteMany({ where: { modifierGroupId: groupId } });
    await prisma.modifierGroup.deleteMany({ where: { restaurantId } });
    await prisma.menuItem.deleteMany({ where: { restaurantId } });
    await prisma.menuCategory.deleteMany({ where: { restaurantId } });
    await prisma.restaurantTable.deleteMany({ where: { restaurantId } });
    await prisma.staffMembership.deleteMany({ where: { restaurantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await prisma.$disconnect();
  });

  it("creates a complete order with authoritative snapshots and history", async () => {
    const order = await submit();
    expect(order).toMatchObject({
      tableSessionId: sessionId,
      status: "PENDING",
      version: 1,
      totalMinor: 25_000,
    });
    expect(order.items[0]).toMatchObject({
      itemNameSnapshot: "Paneer Bowl",
      unitPriceMinor: 10_000,
      lineTotalMinor: 25_000,
      batchNumber: 1,
    });
    expect(order.items[0]?.modifiers[0]).toMatchObject({
      modifierNameSnapshot: "Extra paneer",
      modifierPriceMinor: 2_500,
    });
    const historyResponse = await request(app())
      .get(`/api/v1/orders/${order.id}/history`)
      .expect(200);
    expect(
      orderHistoryResponseSchema.parse(historyResponse.body).history[0],
    ).toMatchObject({ previousStatus: null, newStatus: "PENDING" });
  });

  it("rejects unknown and closed sessions without partial writes", async () => {
    await request(app())
      .post("/api/v1/orders")
      .set("idempotency-key", `invalid-${randomUUID()}`)
      .send({ ...orderPayload(), tableSessionId: randomUUID() })
      .expect(404);
    await prisma.tableSession.update({
      where: { id_restaurantId: { id: sessionId, restaurantId } },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedByMembershipId: membershipId,
      },
    });
    const closed = await request(app())
      .post("/api/v1/orders")
      .set("idempotency-key", `closed-${randomUUID()}`)
      .send(orderPayload())
      .expect(409);
    expect(errorResponseSchema.parse(closed.body).error.code).toBe(
      "TABLE_SESSION_CLOSED",
    );
    expect(await prisma.order.count({ where: { restaurantId } })).toBe(0);
    expect(await prisma.idempotencyKey.count({ where: { restaurantId } })).toBe(
      0,
    );
  });

  it("rejects unavailable items and invalid modifier selections", async () => {
    await prisma.menuItem.update({
      where: { id_restaurantId: { id: menuItemId, restaurantId } },
      data: { isAvailable: false },
    });
    await request(app())
      .post("/api/v1/orders")
      .set("idempotency-key", `unavailable-${randomUUID()}`)
      .send(orderPayload())
      .expect(409);
    await prisma.menuItem.update({
      where: { id_restaurantId: { id: menuItemId, restaurantId } },
      data: { isAvailable: true },
    });
    const invalid = await request(app())
      .post("/api/v1/orders")
      .set("idempotency-key", `modifier-${randomUUID()}`)
      .send({
        tableSessionId: sessionId,
        items: [{ menuItemId, quantity: 1, modifierIds: [] }],
      })
      .expect(400);
    expect(errorResponseSchema.parse(invalid.body).error.code).toBe(
      "INVALID_MODIFIER_SELECTION",
    );
    expect(await prisma.order.count({ where: { restaurantId } })).toBe(0);
    expect(await prisma.idempotencyKey.count({ where: { restaurantId } })).toBe(
      0,
    );
    await prisma.menuCategory.update({
      where: { id_restaurantId: { id: categoryId, restaurantId } },
      data: { isActive: false },
    });
    await request(app())
      .post("/api/v1/orders")
      .set("idempotency-key", `category-${randomUUID()}`)
      .send(orderPayload())
      .expect(409);
  });

  it("preserves historical prices when menu prices change", async () => {
    const order = await submit();
    await prisma.menuItem.update({
      where: { id_restaurantId: { id: menuItemId, restaurantId } },
      data: { priceMinor: 30_000 },
    });
    const response = await request(app())
      .get(`/api/v1/orders/${order.id}`)
      .expect(200);
    const reloaded = orderResponseSchema.parse(response.body).order;
    expect(reloaded.items[0]?.unitPriceMinor).toBe(10_000);
    expect(reloaded.totalMinor).toBe(25_000);
  });

  it("replays duplicate keys, blocks conflicting payloads, and prevents concurrent duplicates", async () => {
    const key = `duplicate-${randomUUID()}`;
    const first = await submit(key);
    const replayed = await submit(key);
    expect(replayed).toEqual(first);
    const conflict = await request(app())
      .post("/api/v1/orders")
      .set("idempotency-key", key)
      .send(orderPayload(1))
      .expect(409);
    expect(errorResponseSchema.parse(conflict.body).error.code).toBe(
      "IDEMPOTENCY_KEY_CONFLICT",
    );

    await cleanOrdersAndSessions();
    sessionId = randomUUID();
    await prisma.tableSession.create({
      data: {
        id: sessionId,
        restaurantId,
        tableId,
        openedByMembershipId: membershipId,
      },
    });
    const concurrentKey = `concurrent-${randomUUID()}`;
    const [left, right] = await Promise.all([
      request(app())
        .post("/api/v1/orders")
        .set("idempotency-key", concurrentKey)
        .send(orderPayload()),
      request(app())
        .post("/api/v1/orders")
        .set("idempotency-key", concurrentKey)
        .send(orderPayload()),
    ]);
    expect([left.status, right.status]).toEqual([201, 201]);
    expect(orderResponseSchema.parse(left.body).order.id).toBe(
      orderResponseSchema.parse(right.body).order.id,
    );
    expect(await prisma.order.count({ where: { restaurantId } })).toBe(1);
  });

  it("adds immutable item batches using current prices and optimistic versions", async () => {
    const order = await submit();
    await prisma.menuItem.update({
      where: { id_restaurantId: { id: menuItemId, restaurantId } },
      data: { priceMinor: 20_000 },
    });
    const response = await request(app())
      .post(`/api/v1/orders/${order.id}/items`)
      .set("idempotency-key", `add-${randomUUID()}`)
      .send({
        version: order.version,
        items: [{ menuItemId, quantity: 1, modifierIds: [modifierId] }],
      })
      .expect(200);
    const updated = orderResponseSchema.parse(response.body).order;
    expect(updated.version).toBe(2);
    expect(updated.items.map((item) => item.batchNumber)).toEqual([1, 2]);
    expect(updated.items.map((item) => item.unitPriceMinor)).toEqual([
      10_000, 20_000,
    ]);
    expect(updated.totalMinor).toBe(47_500);
    await request(app())
      .post(`/api/v1/orders/${order.id}/items`)
      .set("idempotency-key", `stale-${randomUUID()}`)
      .send({
        version: 1,
        items: [{ menuItemId, quantity: 1, modifierIds: [modifierId] }],
      })
      .expect(409);
  });

  it("allows only one concurrent versioned status update and rejects invalid transitions", async () => {
    const order = await submit();
    const [accepted, cancelled] = await Promise.all([
      request(app("MANAGER"))
        .patch(`/api/v1/orders/${order.id}/status`)
        .send({ version: 1, status: "ACCEPTED" }),
      request(app("MANAGER"))
        .patch(`/api/v1/orders/${order.id}/status`)
        .send({ version: 1, status: "CANCELLED" }),
    ]);
    expect([accepted.status, cancelled.status].sort()).toEqual([200, 409]);
    const current = await request(app())
      .get(`/api/v1/orders/${order.id}`)
      .expect(200);
    const currentOrder = orderResponseSchema.parse(current.body).order;
    const invalid = await request(app("MANAGER"))
      .patch(`/api/v1/orders/${order.id}/status`)
      .send({ version: currentOrder.version, status: "READY" })
      .expect(409);
    expect(errorResponseSchema.parse(invalid.body).error.code).toBe(
      "INVALID_ORDER_STATUS_TRANSITION",
    );
  });

  it("enforces restaurant isolation and role permissions", async () => {
    const order = await submit();
    await request(app("WAITER", otherRestaurantId))
      .get(`/api/v1/orders/${order.id}`)
      .expect(404);
    await request(app("KITCHEN"))
      .post("/api/v1/orders")
      .set("idempotency-key", `kitchen-${randomUUID()}`)
      .send(orderPayload())
      .expect(403);
    await request(app("WAITER"))
      .patch(`/api/v1/orders/${order.id}/status`)
      .send({ version: order.version, status: "ACCEPTED" })
      .expect(403);
    const listing = await request(app("CASHIER"))
      .get("/api/v1/orders")
      .query({ tableSessionId: sessionId, status: "PENDING" })
      .expect(200);
    expect(orderListResponseSchema.parse(listing.body).orders).toHaveLength(1);
  });

  it("runs the kitchen item workflow, aggregate readiness, audit history, and waiter service", async () => {
    const order = await submit();
    const tickets = await request(app("KITCHEN"))
      .get("/api/v1/kitchen/tickets")
      .expect(200);
    expect(
      kitchenTicketListResponseSchema.parse(tickets.body).orders,
    ).toHaveLength(1);
    await request(app("WAITER")).get("/api/v1/kitchen/tickets").expect(403);
    const isolated = await request(app("KITCHEN", otherRestaurantId))
      .get("/api/v1/kitchen/tickets")
      .expect(200);
    expect(isolated.body).toEqual({ orders: [] });

    const acceptedResponse = await request(app("KITCHEN"))
      .patch(`/api/v1/kitchen/orders/${order.id}/status`)
      .send({ version: order.version, status: "ACCEPTED" })
      .expect(200);
    const accepted = orderResponseSchema.parse(acceptedResponse.body).order;
    const preparingResponse = await request(app("KITCHEN"))
      .patch(`/api/v1/kitchen/orders/${order.id}/status`)
      .send({ version: accepted.version, status: "PREPARING" })
      .expect(200);
    const preparing = orderResponseSchema.parse(preparingResponse.body).order;
    expect(preparing.items[0]?.status).toBe("PREPARING");

    const readyResponse = await request(app("KITCHEN"))
      .patch(`/api/v1/kitchen/items/${preparing.items[0]!.id}/status`)
      .send({ version: preparing.version, status: "READY" })
      .expect(200);
    const ready = orderResponseSchema.parse(readyResponse.body).order;
    expect(ready.status).toBe("READY");

    const servedResponse = await request(app("WAITER"))
      .patch(`/api/v1/orders/${order.id}/status`)
      .send({ version: ready.version, status: "SERVED" })
      .expect(200);
    const served = orderResponseSchema.parse(servedResponse.body).order;
    expect(served.items[0]?.status).toBe("SERVED");
    const history = await request(app("MANAGER"))
      .get(`/api/v1/orders/${order.id}/history`)
      .expect(200);
    expect(
      orderHistoryResponseSchema
        .parse(history.body)
        .history.map((entry) => entry.newStatus),
    ).toEqual(["PENDING", "ACCEPTED", "PREPARING", "READY", "SERVED"]);
    expect(
      await prisma.orderItemStatusHistory.count({
        where: { restaurantId, orderItemId: preparing.items[0]!.id },
      }),
    ).toBe(3);
  });

  it("reopens a ready order for a new batch without resetting ready items", async () => {
    const order = await submit();
    const accept = orderResponseSchema.parse(
      (
        await request(app("KITCHEN"))
          .patch(`/api/v1/orders/${order.id}/status`)
          .send({ version: order.version, status: "ACCEPTED" })
          .expect(200)
      ).body,
    ).order;
    const preparing = orderResponseSchema.parse(
      (
        await request(app("KITCHEN"))
          .patch(`/api/v1/orders/${order.id}/status`)
          .send({ version: accept.version, status: "PREPARING" })
          .expect(200)
      ).body,
    ).order;
    const ready = orderResponseSchema.parse(
      (
        await request(app("KITCHEN"))
          .patch(`/api/v1/orders/${order.id}/status`)
          .send({ version: preparing.version, status: "READY" })
          .expect(200)
      ).body,
    ).order;
    const added = orderResponseSchema.parse(
      (
        await request(app("WAITER"))
          .post(`/api/v1/orders/${order.id}/items`)
          .set("idempotency-key", `ready-batch-${randomUUID()}`)
          .send({
            version: ready.version,
            items: [{ menuItemId, quantity: 1, modifierIds: [modifierId] }],
          })
          .expect(200)
      ).body,
    ).order;
    expect(added.status).toBe("PREPARING");
    expect(added.items.map((item) => [item.batchNumber, item.status])).toEqual([
      [1, "READY"],
      [2, "PENDING"],
    ]);

    const second = added.items[1]!;
    const started = orderResponseSchema.parse(
      (
        await request(app("KITCHEN"))
          .patch(`/api/v1/kitchen/items/${second.id}/status`)
          .send({ version: added.version, status: "PREPARING" })
          .expect(200)
      ).body,
    ).order;
    const completed = orderResponseSchema.parse(
      (
        await request(app("KITCHEN"))
          .patch(`/api/v1/kitchen/items/${second.id}/status`)
          .send({ version: started.version, status: "READY" })
          .expect(200)
      ).body,
    ).order;
    expect(completed.status).toBe("READY");
    expect(completed.items[0]?.status).toBe("READY");
  });

  it("serializes concurrent item updates and protects cancelled orders", async () => {
    const order = await submit();
    const accepted = orderResponseSchema.parse(
      (
        await request(app("KITCHEN"))
          .patch(`/api/v1/orders/${order.id}/status`)
          .send({ version: order.version, status: "ACCEPTED" })
          .expect(200)
      ).body,
    ).order;
    const itemId = accepted.items[0]!.id;
    const [left, right] = await Promise.all([
      request(app("KITCHEN"))
        .patch(`/api/v1/kitchen/items/${itemId}/status`)
        .send({ version: accepted.version, status: "PREPARING" }),
      request(app("KITCHEN"))
        .patch(`/api/v1/kitchen/items/${itemId}/status`)
        .send({ version: accepted.version, status: "PREPARING" }),
    ]);
    expect([left.status, right.status].sort()).toEqual([200, 409]);
    const current = orderResponseSchema.parse(
      (left.status === 200 ? left : right).body,
    ).order;
    const cancelled = orderResponseSchema.parse(
      (
        await request(app("MANAGER"))
          .patch(`/api/v1/orders/${order.id}/status`)
          .send({ version: current.version, status: "CANCELLED" })
          .expect(200)
      ).body,
    ).order;
    expect(cancelled.items[0]?.status).toBe("CANCELLED");
    await request(app("KITCHEN"))
      .patch(`/api/v1/kitchen/items/${itemId}/status`)
      .send({ version: cancelled.version, status: "READY" })
      .expect(409);
  });

  it("publishes only committed non-replayed changes", async () => {
    const events: Parameters<RealtimePublisher["orderChanged"]>[0][] = [];
    const publisher: RealtimePublisher = {
      orderChanged: (event) => {
        events.push(event);
        return Promise.resolve();
      },
    };
    const key = `published-${randomUUID()}`;
    const firstResponse = await request(app("WAITER", restaurantId, publisher))
      .post("/api/v1/orders")
      .set("idempotency-key", key)
      .send(orderPayload())
      .expect(201);
    await request(app("WAITER", restaurantId, publisher))
      .post("/api/v1/orders")
      .set("idempotency-key", key)
      .send(orderPayload())
      .expect(201);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ changeType: "CREATED", orderVersion: 1 });

    const created = orderResponseSchema.parse(firstResponse.body).order;
    await request(app("KITCHEN", restaurantId, publisher))
      .patch(`/api/v1/orders/${created.id}/status`)
      .send({ version: 999, status: "ACCEPTED" })
      .expect(409);
    expect(events).toHaveLength(1);
  });

  it("blocks session closure until orders are resolved and served items are billed", async () => {
    const order = await submit();
    const blocked = await request(app())
      .post(`/api/v1/table-sessions/${sessionId}/close`)
      .expect(409);
    expect(errorResponseSchema.parse(blocked.body).error.code).toBe(
      "TABLE_SESSION_HAS_UNRESOLVED_ORDERS",
    );
    const acceptedResponse = await request(app("MANAGER"))
      .patch(`/api/v1/orders/${order.id}/status`)
      .send({ version: order.version, status: "ACCEPTED" })
      .expect(200);
    const accepted = orderResponseSchema.parse(acceptedResponse.body).order;
    const preparingResponse = await request(app("KITCHEN"))
      .patch(`/api/v1/orders/${order.id}/status`)
      .send({ version: accepted.version, status: "PREPARING" })
      .expect(200);
    const preparing = orderResponseSchema.parse(preparingResponse.body).order;
    const readyResponse = await request(app("KITCHEN"))
      .patch(`/api/v1/orders/${order.id}/status`)
      .send({ version: preparing.version, status: "READY" })
      .expect(200);
    const ready = orderResponseSchema.parse(readyResponse.body).order;
    await request(app("WAITER"))
      .patch(`/api/v1/orders/${order.id}/status`)
      .send({ version: ready.version, status: "SERVED" })
      .expect(200);
    const billingBlocked = await request(app())
      .post(`/api/v1/table-sessions/${sessionId}/close`)
      .expect(409);
    expect(errorResponseSchema.parse(billingBlocked.body).error.code).toBe(
      "TABLE_SESSION_BILLING_INCOMPLETE",
    );
  });
});
