import "dotenv/config";

import { randomBytes, randomUUID } from "node:crypto";

import type { AuthenticatedUser } from "@restroflow/contracts";
import {
  customerOrderResponseSchema,
  customerSessionResponseSchema,
  publicTableMenuResponseSchema,
  publicTableResponseSchema,
  tableOrderingActivationResponseSchema,
} from "@restroflow/contracts";
import pino from "pino";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import { createPrismaClient } from "../../lib/prisma.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import { Argon2PasswordHasher } from "../auth/auth.service.js";
import { PrismaOrderRepository } from "../orders/order.repository.js";
import { OrderService } from "../orders/order.service.js";
import type { RealtimePublisher } from "../realtime/realtime.publisher.js";
import { PrismaCustomerRepository } from "./customer.repository.js";
import { CustomerService } from "./customer.service.js";

const databaseUrl = process.env.DATABASE_URL;
const run = databaseUrl ? describe : describe.skip;

run("customer QR ordering against PostgreSQL", () => {
  const prisma = createPrismaClient(databaseUrl!);
  const suffix = randomUUID().slice(0, 8);
  const restaurantId = randomUUID();
  const userId = randomUUID();
  const membershipId = randomUUID();
  const tableId = randomUUID();
  const tableSessionId = randomUUID();
  const categoryId = randomUUID();
  const itemId = randomUUID();
  const hiddenItemId = randomUUID();
  const groupId = randomUUID();
  const modifierId = randomUUID();
  const identifier = randomBytes(32).toString("base64url");
  const published: Parameters<RealtimePublisher["orderChanged"]>[0][] = [];

  const user: AuthenticatedUser = {
    id: userId,
    email: `customer-${suffix}@example.test`,
    displayName: "Customer Test Waiter",
    memberships: [
      {
        restaurantId,
        restaurantName: "Customer Test",
        role: "WAITER",
      },
    ],
  };
  const authService: AuthServiceContract = {
    login: () => Promise.reject(new Error("unused")),
    logout: () => Promise.resolve(),
    authenticate: (token) =>
      token === "staff-token"
        ? Promise.resolve({
            user,
            sessionTokenHash: "staff-test",
            membershipIds: { [restaurantId]: membershipId },
          })
        : Promise.reject(new Error("UNAUTHENTICATED")),
  };
  const publisher: RealtimePublisher = {
    orderChanged: (event) => {
      published.push(event);
      return Promise.resolve();
    },
  };
  const orderService = new OrderService(
    new PrismaOrderRepository(prisma),
    publisher,
  );
  const customerService = new CustomerService(
    new PrismaCustomerRepository(prisma),
    new Argon2PasswordHasher(),
    orderService,
  );
  const app = createApp({
    allowedOrigins: ["http://localhost:3000"],
    authService,
    cookieOptions: { secure: false, maxAgeMs: 60_000 },
    customerService,
    customerCookieOptions: { secure: false, maxAgeMs: 4 * 60 * 60 * 1000 },
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
    orderService,
  });

  async function clearCustomerData() {
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
  }

  async function activate(agent = request.agent(app)) {
    const issued = await request(app)
      .post(`/api/v1/table-sessions/${tableSessionId}/customer-access`)
      .set("Cookie", "restroflow_session=staff-token")
      .set("x-restaurant-id", restaurantId)
      .expect(201);
    const activation = tableOrderingActivationResponseSchema.parse(
      issued.body,
    ).activation;
    const response = await agent
      .post("/api/v1/public/table-access/activate")
      .send({ identifier, activationCode: activation.activationCode })
      .expect(201);
    customerSessionResponseSchema.parse(response.body);
    return agent;
  }

  beforeAll(async () => {
    await prisma.restaurant.create({
      data: {
        id: restaurantId,
        name: `Customer Test ${suffix}`,
        slug: `customer-test-${suffix}`,
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `customer-${suffix}@example.test`,
        displayName: "Customer Test Waiter",
        passwordHash: "unused",
      },
    });
    await prisma.staffMembership.create({
      data: { id: membershipId, userId, restaurantId, role: "WAITER" },
    });
    await prisma.restaurantTable.create({
      data: {
        id: tableId,
        restaurantId,
        tableNumber: `C-${suffix}`,
        displayName: "Patio table",
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
      data: { id: categoryId, restaurantId, name: `Mains ${suffix}` },
    });
    await prisma.menuItem.createMany({
      data: [
        {
          id: itemId,
          restaurantId,
          categoryId,
          name: "Customer Paneer",
          priceMinor: 10_000,
          isVegetarian: true,
        },
        {
          id: hiddenItemId,
          restaurantId,
          categoryId,
          name: "Hidden item",
          priceMinor: 1,
          isAvailable: false,
        },
      ],
    });
    await prisma.modifierGroup.create({
      data: {
        id: groupId,
        restaurantId,
        name: `Spice ${suffix}`,
        minSelections: 1,
        maxSelections: 1,
      },
    });
    await prisma.modifier.create({
      data: {
        id: modifierId,
        modifierGroupId: groupId,
        name: "Medium",
        priceDeltaMinor: 500,
      },
    });
    await prisma.menuItemModifierGroup.create({
      data: { restaurantId, menuItemId: itemId, modifierGroupId: groupId },
    });
  });

  beforeEach(async () => {
    await clearCustomerData();
    published.length = 0;
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isActive: true },
    });
    await prisma.restaurantTable.update({
      where: { id_restaurantId: { id: tableId, restaurantId } },
      data: { isActive: true, qrIdentifier: identifier },
    });
    await prisma.tableSession.update({
      where: { id_restaurantId: { id: tableSessionId, restaurantId } },
      data: { status: "OPEN", closedAt: null, closedByMembershipId: null },
    });
    await prisma.menuItem.update({
      where: { id_restaurantId: { id: itemId, restaurantId } },
      data: { priceMinor: 10_000, isAvailable: true, isActive: true },
    });
  });

  afterAll(async () => {
    await clearCustomerData();
    await prisma.menuItemModifierGroup.deleteMany({ where: { restaurantId } });
    await prisma.modifier.deleteMany({ where: { modifierGroupId: groupId } });
    await prisma.modifierGroup.deleteMany({ where: { restaurantId } });
    await prisma.menuItem.deleteMany({ where: { restaurantId } });
    await prisma.menuCategory.deleteMany({ where: { restaurantId } });
    await prisma.tableSession.deleteMany({ where: { restaurantId } });
    await prisma.restaurantTable.deleteMany({ where: { restaurantId } });
    await prisma.staffMembership.deleteMany({ where: { restaurantId } });
    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
    await prisma.$disconnect();
  });

  it("resolves active QR context and exposes only the public available menu", async () => {
    const table = await request(app)
      .get(`/api/v1/public/tables/${identifier}`)
      .expect(200);
    expect(publicTableResponseSchema.parse(table.body).context).toMatchObject({
      table: { displayName: "Patio table" },
      hasActiveSession: true,
    });
    const menu = publicTableMenuResponseSchema.parse(
      (
        await request(app)
          .get(`/api/v1/public/tables/${identifier}/menu`)
          .expect(200)
      ).body,
    );
    expect(menu.items.map((item) => item.id)).toEqual([itemId]);
    expect(JSON.stringify(menu)).not.toContain("isActive");
    await request(app)
      .get(`/api/v1/public/tables/${randomBytes(32).toString("base64url")}`)
      .expect(404);
  });

  it("invalidates rotated QR identifiers and inactive restaurants", async () => {
    const old = identifier;
    const rotated = randomBytes(32).toString("base64url");
    await prisma.restaurantTable.update({
      where: { id: tableId },
      data: { qrIdentifier: rotated },
    });
    await request(app).get(`/api/v1/public/tables/${old}`).expect(404);
    await prisma.restaurant.update({
      where: { id: restaurantId },
      data: { isActive: false },
    });
    await request(app).get(`/api/v1/public/tables/${rotated}`).expect(404);
  });

  it("locks activation after failed guesses and creates a separately scoped session", async () => {
    const issued = tableOrderingActivationResponseSchema.parse(
      (
        await request(app)
          .post(`/api/v1/table-sessions/${tableSessionId}/customer-access`)
          .set("Cookie", "restroflow_session=staff-token")
          .set("x-restaurant-id", restaurantId)
          .expect(201)
      ).body,
    );
    for (let attempt = 0; attempt < 5; attempt += 1)
      await request(app)
        .post("/api/v1/public/table-access/activate")
        .send({ identifier, activationCode: "999999" })
        .expect(401);
    await request(app)
      .post("/api/v1/public/table-access/activate")
      .send({ identifier, activationCode: issued.activation.activationCode })
      .expect(429);
  });

  it("creates authoritative customer orders with scoped idempotency and one kitchen event", async () => {
    const agent = await activate();
    const key = `customer-${randomUUID()}`;
    const payload = {
      items: [
        {
          menuItemId: itemId,
          quantity: 2,
          modifierIds: [modifierId],
          specialInstructions: "No onion",
        },
      ],
    };
    const first = customerOrderResponseSchema.parse(
      (
        await agent
          .post("/api/v1/public/orders")
          .set("idempotency-key", key)
          .send(payload)
          .expect(201)
      ).body,
    ).order;
    expect(first).toMatchObject({ source: "CUSTOMER", totalMinor: 21_000 });
    expect(first.items[0]).toMatchObject({
      itemNameSnapshot: "Customer Paneer",
      unitPriceMinor: 10_000,
      lineTotalMinor: 21_000,
    });
    const replay = customerOrderResponseSchema.parse(
      (
        await agent
          .post("/api/v1/public/orders")
          .set("idempotency-key", key)
          .send(payload)
          .expect(201)
      ).body,
    ).order;
    expect(replay.id).toBe(first.id);
    expect(published).toHaveLength(1);
    expect(published[0]?.orderId).toBe(first.id);
    expect(typeof published[0]?.customerOrderingSessionId).toBe("string");
    await agent
      .post("/api/v1/public/orders")
      .set("idempotency-key", key)
      .send({ ...payload, items: [{ ...payload.items[0], quantity: 3 }] })
      .expect(409);
  });

  it("serializes concurrent customer retries into one order", async () => {
    const agent = await activate();
    const key = `concurrent-${randomUUID()}`;
    const payload = {
      items: [{ menuItemId: itemId, quantity: 1, modifierIds: [modifierId] }],
    };
    const [left, right] = await Promise.all([
      agent
        .post("/api/v1/public/orders")
        .set("idempotency-key", key)
        .send(payload),
      agent
        .post("/api/v1/public/orders")
        .set("idempotency-key", key)
        .send(payload),
    ]);
    expect(left.status).toBe(201);
    expect(right.status).toBe(201);
    const leftOrder = customerOrderResponseSchema.parse(left.body).order;
    const rightOrder = customerOrderResponseSchema.parse(right.body).order;
    expect(rightOrder.id).toBe(leftOrder.id);
    expect(await prisma.order.count({ where: { id: leftOrder.id } })).toBe(1);
    expect(published).toHaveLength(1);
  });

  it("prevents cross-session reads and rejects expired or closed sessions", async () => {
    const firstAgent = await activate();
    const created = customerOrderResponseSchema.parse(
      (
        await firstAgent
          .post("/api/v1/public/orders")
          .set("idempotency-key", `customer-${randomUUID()}`)
          .send({
            items: [
              { menuItemId: itemId, quantity: 1, modifierIds: [modifierId] },
            ],
          })
          .expect(201)
      ).body,
    ).order;
    const secondAgent = await activate();
    await secondAgent.get(`/api/v1/public/orders/${created.id}`).expect(404);

    const secondSession = await prisma.customerOrderingSession.findFirstOrThrow(
      {
        where: { restaurantId },
        orderBy: { createdAt: "desc" },
      },
    );
    await prisma.customerOrderingSession.update({
      where: { id: secondSession.id },
      data: {
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        expiresAt: new Date(Date.now() - 60 * 60 * 1000),
      },
    });
    await secondAgent.get("/api/v1/public/customer-session").expect(401);

    await prisma.tableSession.update({
      where: { id: tableSessionId },
      data: {
        status: "CLOSED",
        closedAt: new Date(),
        closedByMembershipId: membershipId,
      },
    });
    await firstAgent.get("/api/v1/public/orders").expect(401);
  });
});
