import type {
  KitchenTicketListQuery,
  OrderItemStatus,
  OrderListQuery,
  OrderStatus,
} from "@restroflow/contracts";

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

export type OrderActor =
  { kind: "staff"; id: string } | { kind: "customer"; id: string };

export type LockedTableSession = {
  id: string;
  status: "OPEN" | "CLOSED";
  closedAt: Date | null;
  bill: { id: string } | null;
};

export type OrderSummary = {
  id: string;
  tableSessionId: string;
  status: OrderStatus;
  version: number;
  totalMinor: number;
  customerOrderingSessionId: string | null;
  maximumBatch: number;
  items: { id: string; status: OrderItemStatus }[];
};

export type ItemStatusChange = {
  itemId: string;
  previousStatus: OrderItemStatus;
  newStatus: OrderItemStatus;
};

export interface OrderTransaction {
  findIdempotency(
    restaurantId: string,
    actor: OrderActor,
    key: string,
  ): Promise<IdempotencyRecord | null>;
  reserveIdempotency(input: {
    restaurantId: string;
    actor: OrderActor;
    key: string;
    operation: "CREATE_ORDER" | "ADD_ORDER_ITEMS";
    requestHash: string;
    expiresAt: Date;
  }): Promise<void>;
  completeIdempotency(
    restaurantId: string,
    actor: OrderActor,
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
    actor: OrderActor;
    source: "WAITER" | "CUSTOMER";
    totalMinor: number;
    items: OrderWriteItem[];
  }): Promise<OrderRecord>;
  addItems(input: {
    restaurantId: string;
    orderId: string;
    expectedVersion: number;
    totalMinor: number;
    items: OrderWriteItem[];
    actorMembershipId: string;
    previousStatus: OrderStatus;
    newStatus: OrderStatus;
  }): Promise<OrderRecord | null>;
  applyStatusChanges(input: {
    restaurantId: string;
    orderId: string;
    expectedVersion: number;
    previousStatus: OrderStatus;
    newStatus: OrderStatus;
    actorMembershipId: string;
    reason: string | null;
    itemChanges: ItemStatusChange[];
  }): Promise<OrderRecord | null>;
}

export interface OrderRepository {
  transaction<T>(
    work: (transaction: OrderTransaction) => Promise<T>,
  ): Promise<T>;
  findIdempotency(
    restaurantId: string,
    actor: OrderActor,
    key: string,
  ): Promise<IdempotencyRecord | null>;
  listOrders(
    restaurantId: string,
    query: OrderListQuery,
  ): Promise<{ records: OrderRecord[]; total: number }>;
  listKitchenTickets(
    restaurantId: string,
    query: KitchenTicketListQuery,
  ): Promise<OrderRecord[]>;
  findOrder(restaurantId: string, orderId: string): Promise<OrderRecord | null>;
  listCustomerOrders(
    restaurantId: string,
    customerOrderingSessionId: string,
  ): Promise<OrderRecord[]>;
  findCustomerOrder(
    restaurantId: string,
    customerOrderingSessionId: string,
    orderId: string,
  ): Promise<OrderRecord | null>;
  findOrderCustomerSessionId(
    restaurantId: string,
    orderId: string,
  ): Promise<string | null>;
  findOrderIdByItem(
    restaurantId: string,
    itemId: string,
  ): Promise<string | null>;
  listHistory(
    restaurantId: string,
    orderId: string,
  ): Promise<OrderHistoryRecord[]>;
}

function idempotencyWhere(
  restaurantId: string,
  actor: OrderActor,
  key: string,
) {
  return actor.kind === "staff"
    ? {
        restaurantId_actorMembershipId_key: {
          restaurantId,
          actorMembershipId: actor.id,
          key,
        },
      }
    : {
        restaurantId_customerOrderingSessionId_key: {
          restaurantId,
          customerOrderingSessionId: actor.id,
          key,
        },
      };
}

function createTransaction(client: Prisma.TransactionClient): OrderTransaction {
  return {
    findIdempotency: (restaurantId, actor, key) =>
      client.idempotencyKey.findUnique({
        where: idempotencyWhere(restaurantId, actor, key),
        select: { operation: true, requestHash: true, responseBody: true },
      }),
    reserveIdempotency: async (input) => {
      const { actor, ...data } = input;
      await client.idempotencyKey.create({
        data: {
          ...data,
          ...(actor.kind === "staff"
            ? { actorMembershipId: actor.id }
            : { customerOrderingSessionId: actor.id }),
        },
      });
    },
    completeIdempotency: async (
      restaurantId,
      actor,
      key,
      resultOrderId,
      responseBody,
    ) => {
      await client.idempotencyKey.update({
        where: idempotencyWhere(restaurantId, actor, key),
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
        select: {
          id: true,
          status: true,
          closedAt: true,
          bill: { select: { id: true } },
        },
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
          customerOrderingSessionId: true,
          items: { select: { id: true, status: true, batchNumber: true } },
        },
      });
      return order
        ? {
            ...order,
            maximumBatch: Math.max(
              0,
              ...order.items.map((item) => item.batchNumber),
            ),
            items: order.items.map(({ id, status }) => ({ id, status })),
          }
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
          customerOrderingSessionId: true,
          items: { select: { id: true, status: true, batchNumber: true } },
        },
      });
      return {
        ...order,
        maximumBatch: Math.max(
          0,
          ...order.items.map((item) => item.batchNumber),
        ),
        items: order.items.map(({ id, status }) => ({ id, status })),
      };
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
          source: input.source,
          ...(input.actor.kind === "staff"
            ? { createdByMembershipId: input.actor.id }
            : { customerOrderingSessionId: input.actor.id }),
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
              ...(input.actor.kind === "staff"
                ? { actorMembershipId: input.actor.id }
                : { customerOrderingSessionId: input.actor.id }),
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
          status: input.newStatus,
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
      if (input.previousStatus !== input.newStatus) {
        await client.orderStatusHistory.create({
          data: {
            orderId: input.orderId,
            restaurantId: input.restaurantId,
            previousStatus: input.previousStatus,
            newStatus: input.newStatus,
            actorMembershipId: input.actorMembershipId,
            reason: "New item batch added",
          },
        });
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
    applyStatusChanges: async (input) => {
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
      for (const change of input.itemChanges) {
        const item = await client.orderItem.updateMany({
          where: {
            id: change.itemId,
            orderId: input.orderId,
            restaurantId: input.restaurantId,
            status: change.previousStatus,
          },
          data: { status: change.newStatus },
        });
        if (item.count === 0) return null;
        await client.orderItemStatusHistory.create({
          data: {
            orderItemId: change.itemId,
            restaurantId: input.restaurantId,
            previousStatus: change.previousStatus,
            newStatus: change.newStatus,
            actorMembershipId: input.actorMembershipId,
            reason: input.reason,
          },
        });
      }
      if (input.previousStatus !== input.newStatus) {
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
  };
}

export class PrismaOrderRepository implements OrderRepository {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(work: (transaction: OrderTransaction) => Promise<T>) {
    return this.prisma.$transaction((client) =>
      work(createTransaction(client)),
    );
  }

  findIdempotency(restaurantId: string, actor: OrderActor, key: string) {
    return this.prisma.idempotencyKey.findUnique({
      where: idempotencyWhere(restaurantId, actor, key),
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

  listKitchenTickets(restaurantId: string, query: KitchenTicketListQuery) {
    return this.prisma.order.findMany({
      where: { restaurantId, status: { in: query.statuses } },
      select: orderSelection,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: query.limit,
    });
  }

  findOrder(restaurantId: string, orderId: string) {
    return this.prisma.order.findUnique({
      where: { id_restaurantId: { id: orderId, restaurantId } },
      select: orderSelection,
    });
  }

  listCustomerOrders(restaurantId: string, customerOrderingSessionId: string) {
    return this.prisma.order.findMany({
      where: { restaurantId, customerOrderingSessionId },
      select: orderSelection,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 100,
    });
  }

  findCustomerOrder(
    restaurantId: string,
    customerOrderingSessionId: string,
    orderId: string,
  ) {
    return this.prisma.order.findFirst({
      where: { id: orderId, restaurantId, customerOrderingSessionId },
      select: orderSelection,
    });
  }

  async findOrderCustomerSessionId(restaurantId: string, orderId: string) {
    const order = await this.prisma.order.findFirst({
      where: { id: orderId, restaurantId },
      select: { customerOrderingSessionId: true },
    });
    return order?.customerOrderingSessionId ?? null;
  }

  async findOrderIdByItem(restaurantId: string, itemId: string) {
    const item = await this.prisma.orderItem.findFirst({
      where: { id: itemId, restaurantId },
      select: { orderId: true },
    });
    return item?.orderId ?? null;
  }

  listHistory(restaurantId: string, orderId: string) {
    return this.prisma.orderStatusHistory.findMany({
      where: { restaurantId, orderId },
      select: historySelection,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  }
}
