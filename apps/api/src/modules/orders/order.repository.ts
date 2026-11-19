import type { OrderListQuery, OrderStatus } from "@restroflow/contracts";

import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

const actorSelection = {
  id: true,
  user: { select: { displayName: true } },
} satisfies Prisma.StaffMembershipSelect;

const modifierSelection = {
  id: true,
  modifierGroupId: true,
  modifierId: true,
  modifierGroupNameSnapshot: true,
  modifierNameSnapshot: true,
  modifierPriceMinor: true,
  quantity: true,
} satisfies Prisma.OrderItemModifierSelect;

const itemSelection = {
  id: true,
  menuItemId: true,
  itemNameSnapshot: true,
  quantity: true,
  unitPriceMinor: true,
  lineTotalMinor: true,
  specialInstructions: true,
  status: true,
  batchNumber: true,
  modifiers: {
    select: modifierSelection,
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderItemSelect;

export const orderSelection = {
  id: true,
  restaurantId: true,
  tableSessionId: true,
  tableSession: {
    select: {
      table: {
        select: { id: true, tableNumber: true, displayName: true },
      },
    },
  },
  orderNumber: true,
  source: true,
  status: true,
  version: true,
  totalMinor: true,
  createdBy: { select: actorSelection },
  items: {
    select: itemSelection,
    orderBy: [
      { batchNumber: "asc" as const },
      { createdAt: "asc" as const },
      { id: "asc" as const },
    ],
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.OrderSelect;

const historySelection = {
  id: true,
  previousStatus: true,
  newStatus: true,
  actor: { select: actorSelection },
  reason: true,
  createdAt: true,
} satisfies Prisma.OrderStatusHistorySelect;

export type OrderRecord = Prisma.OrderGetPayload<{
  select: typeof orderSelection;
}>;
export type OrderHistoryRecord = Prisma.OrderStatusHistoryGetPayload<{
  select: typeof historySelection;
}>;

export type MenuItemForOrder = {
  id: string;
  name: string;
  priceMinor: number;
  isActive: boolean;
  isAvailable: boolean;
  category: { isActive: boolean };
  modifierGroups: {
    modifierGroup: {
      id: string;
      name: string;
      minSelections: number;
      maxSelections: number;
      isActive: boolean;
      modifiers: {
        id: string;
        name: string;
        priceDeltaMinor: number;
        isAvailable: boolean;
      }[];
    };
  }[];
};

export type OrderWriteItem = {
  id: string;
  menuItemId: string;
  itemNameSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  specialInstructions: string | null;
  batchNumber: number;
  modifiers: {
    modifierGroupId: string;
    modifierId: string;
    modifierGroupNameSnapshot: string;
    modifierNameSnapshot: string;
    modifierPriceMinor: number;
  }[];
};

export type IdempotencyRecord = {
  operation: "CREATE_ORDER" | "ADD_ORDER_ITEMS";
  requestHash: string;
  responseBody: Prisma.JsonValue | null;
};

export type LockedTableSession = {
  id: string;
  status: "OPEN" | "CLOSED";
  closedAt: Date | null;
};

export type OrderSummary = {
  id: string;
  tableSessionId: string;
  status: OrderStatus;
  version: number;
  totalMinor: number;
  maximumBatch: number;
};

export interface OrderTransaction {
  findIdempotency(
    restaurantId: string,
    actorMembershipId: string,
    key: string,
  ): Promise<IdempotencyRecord | null>;
  reserveIdempotency(input: {
    restaurantId: string;
    actorMembershipId: string;
    key: string;
    operation: "CREATE_ORDER" | "ADD_ORDER_ITEMS";
    requestHash: string;
    expiresAt: Date;
  }): Promise<void>;
  completeIdempotency(
    restaurantId: string,
    actorMembershipId: string,
    key: string,
    resultOrderId: string,
    responseBody: Prisma.InputJsonValue,
  ): Promise<void>;
  lockTableSession(
    restaurantId: string,
    tableSessionId: string,
  ): Promise<LockedTableSession | null>;
  findOrderSummary(
    restaurantId: string,
    orderId: string,
  ): Promise<OrderSummary | null>;
  lockOrder(
    restaurantId: string,
    orderId: string,
  ): Promise<OrderSummary | null>;
  findMenuItems(
    restaurantId: string,
    menuItemIds: string[],
  ): Promise<MenuItemForOrder[]>;
  createOrder(input: {
    restaurantId: string;
    tableSessionId: string;
    orderNumber: string;
    actorMembershipId: string;
    totalMinor: number;
    items: OrderWriteItem[];
  }): Promise<OrderRecord>;
  addItems(input: {
    restaurantId: string;
    orderId: string;
    expectedVersion: number;
    totalMinor: number;
    items: OrderWriteItem[];
  }): Promise<OrderRecord | null>;
  updateStatus(input: {
    restaurantId: string;
    orderId: string;
    expectedVersion: number;
    previousStatus: OrderStatus;
    newStatus: OrderStatus;
    actorMembershipId: string;
    reason: string | null;
  }): Promise<OrderRecord | null>;
}

export interface OrderRepository {
  transaction<T>(
    work: (transaction: OrderTransaction) => Promise<T>,
  ): Promise<T>;
  findIdempotency(
    restaurantId: string,
    actorMembershipId: string,
    key: string,
  ): Promise<IdempotencyRecord | null>;
  listOrders(
    restaurantId: string,
    query: OrderListQuery,
  ): Promise<{ records: OrderRecord[]; total: number }>;
  findOrder(restaurantId: string, orderId: string): Promise<OrderRecord | null>;
  listHistory(
    restaurantId: string,
    orderId: string,
  ): Promise<OrderHistoryRecord[]>;
}

function createTransaction(client: Prisma.TransactionClient): OrderTransaction {
  return {
    findIdempotency: (restaurantId, actorMembershipId, key) =>
      client.idempotencyKey.findUnique({
        where: {
          restaurantId_actorMembershipId_key: {
            restaurantId,
            actorMembershipId,
            key,
          },
        },
        select: { operation: true, requestHash: true, responseBody: true },
      }),
    reserveIdempotency: async (input) => {
      await client.idempotencyKey.create({ data: input });
    },
    completeIdempotency: async (
      restaurantId,
      actorMembershipId,
      key,
      resultOrderId,
      responseBody,
    ) => {
      await client.idempotencyKey.update({
        where: {
          restaurantId_actorMembershipId_key: {
            restaurantId,
            actorMembershipId,
            key,
          },
        },
        data: { resultOrderId, responseBody },
      });
    },
    lockTableSession: async (restaurantId, tableSessionId) => {
      const locked = await client.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "TableSession"
        WHERE "id" = ${tableSessionId}::uuid AND "restaurantId" = ${restaurantId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) return null;
      return client.tableSession.findUnique({
        where: { id_restaurantId: { id: tableSessionId, restaurantId } },
        select: { id: true, status: true, closedAt: true },
      });
    },
    findOrderSummary: async (restaurantId, orderId) => {
      const order = await client.order.findUnique({
        where: { id_restaurantId: { id: orderId, restaurantId } },
        select: {
          id: true,
          tableSessionId: true,
          status: true,
          version: true,
          totalMinor: true,
          items: {
            select: { batchNumber: true },
            orderBy: { batchNumber: "desc" },
            take: 1,
          },
        },
      });
      return order
        ? { ...order, maximumBatch: order.items[0]?.batchNumber ?? 0 }
        : null;
    },
    lockOrder: async (restaurantId, orderId) => {
      const locked = await client.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Order"
        WHERE "id" = ${orderId}::uuid AND "restaurantId" = ${restaurantId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) return null;
      const order = await client.order.findUniqueOrThrow({
        where: { id_restaurantId: { id: orderId, restaurantId } },
        select: {
          id: true,
          tableSessionId: true,
          status: true,
          version: true,
          totalMinor: true,
          items: {
            select: { batchNumber: true },
            orderBy: { batchNumber: "desc" },
            take: 1,
          },
        },
      });
      return { ...order, maximumBatch: order.items[0]?.batchNumber ?? 0 };
    },
    findMenuItems: (restaurantId, menuItemIds) =>
      client.menuItem.findMany({
        where: { restaurantId, id: { in: menuItemIds } },
        select: {
          id: true,
          name: true,
          priceMinor: true,
          isActive: true,
          isAvailable: true,
          category: { select: { isActive: true } },
          modifierGroups: {
            select: {
              modifierGroup: {
                select: {
                  id: true,
                  name: true,
                  minSelections: true,
                  maxSelections: true,
                  isActive: true,
                  modifiers: {
                    select: {
                      id: true,
                      name: true,
                      priceDeltaMinor: true,
                      isAvailable: true,
                    },
                  },
                },
              },
            },
          },
        },
      }),
    createOrder: (input) =>
      client.order.create({
        data: {
          restaurantId: input.restaurantId,
          tableSessionId: input.tableSessionId,
          orderNumber: input.orderNumber,
          createdByMembershipId: input.actorMembershipId,
          totalMinor: input.totalMinor,
          items: {
            create: input.items.map((item) => ({
              id: item.id,
              menuItemId: item.menuItemId,
              itemNameSnapshot: item.itemNameSnapshot,
              quantity: item.quantity,
              unitPriceMinor: item.unitPriceMinor,
              lineTotalMinor: item.lineTotalMinor,
              specialInstructions: item.specialInstructions,
              batchNumber: item.batchNumber,
              modifiers: { create: item.modifiers },
            })),
          },
          statusHistory: {
            create: {
              newStatus: "PENDING",
              actorMembershipId: input.actorMembershipId,
              reason: "Order submitted",
            },
          },
        },
        select: orderSelection,
      }),
    addItems: async (input) => {
      const updated = await client.order.updateMany({
        where: {
          id: input.orderId,
          restaurantId: input.restaurantId,
          version: input.expectedVersion,
        },
        data: {
          version: { increment: 1 },
          totalMinor: { increment: input.totalMinor },
        },
      });
      if (updated.count === 0) return null;
      await client.orderItem.createMany({
        data: input.items.map((item) => ({
          id: item.id,
          menuItemId: item.menuItemId,
          itemNameSnapshot: item.itemNameSnapshot,
          quantity: item.quantity,
          unitPriceMinor: item.unitPriceMinor,
          lineTotalMinor: item.lineTotalMinor,
          specialInstructions: item.specialInstructions,
          batchNumber: item.batchNumber,
          orderId: input.orderId,
          restaurantId: input.restaurantId,
        })),
      });
      for (let index = 0; index < input.items.length; index += 1) {
        const modifiers = input.items[index]!.modifiers;
        if (modifiers.length > 0) {
          await client.orderItemModifier.createMany({
            data: modifiers.map((modifier) => ({
              orderItemId: input.items[index]!.id,
              ...modifier,
            })),
          });
        }
      }
      return client.order.findUniqueOrThrow({
        where: {
          id_restaurantId: {
            id: input.orderId,
            restaurantId: input.restaurantId,
          },
        },
        select: orderSelection,
      });
    },
    updateStatus: async (input) => {
      const updated = await client.order.updateMany({
        where: {
          id: input.orderId,
          restaurantId: input.restaurantId,
          version: input.expectedVersion,
          status: input.previousStatus,
        },
        data: { status: input.newStatus, version: { increment: 1 } },
      });
      if (updated.count === 0) return null;
      await client.orderStatusHistory.create({
        data: {
          orderId: input.orderId,
          restaurantId: input.restaurantId,
          previousStatus: input.previousStatus,
          newStatus: input.newStatus,
          actorMembershipId: input.actorMembershipId,
          reason: input.reason,
        },
      });
      return client.order.findUniqueOrThrow({
        where: {
          id_restaurantId: {
            id: input.orderId,
            restaurantId: input.restaurantId,
          },
        },
        select: orderSelection,
      });
    },
  };
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(work: (transaction: OrderTransaction) => Promise<T>) {
    return this.prisma.$transaction((client) =>
      work(createTransaction(client)),
    );
  }

  findIdempotency(
    restaurantId: string,
    actorMembershipId: string,
    key: string,
  ) {
    return this.prisma.idempotencyKey.findUnique({
      where: {
        restaurantId_actorMembershipId_key: {
          restaurantId,
          actorMembershipId,
          key,
        },
      },
      select: { operation: true, requestHash: true, responseBody: true },
    });
  }

  async listOrders(restaurantId: string, query: OrderListQuery) {
    const where = {
      restaurantId,
      ...(query.tableSessionId ? { tableSessionId: query.tableSessionId } : {}),
      ...(query.status ? { status: query.status } : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        select: orderSelection,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.order.count({ where }),
    ]);
    return { records, total };
  }

  findOrder(restaurantId: string, orderId: string) {
    return this.prisma.order.findUnique({
      where: { id_restaurantId: { id: orderId, restaurantId } },
      select: orderSelection,
    });
  }

  listHistory(restaurantId: string, orderId: string) {
    return this.prisma.orderStatusHistory.findMany({
      where: { restaurantId, orderId },
      select: historySelection,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
