import { createHash, randomUUID } from "node:crypto";

import {
  orderResponseSchema,
  type AddOrderItemsRequest,
  type CreateOrderRequest,
  type CustomerCreateOrderRequest,
  type KitchenTicketListQuery,
  type Order,
  type OrderHistoryEntry,
  type OrderItemInput,
  type OrderListQuery,
  type Role,
  type UpdateOrderItemStatusRequest,
  type UpdateOrderStatusRequest,
} from "@restroflow/contracts";
import { AppError } from "../../errors/app-error.js";
import {
  aggregatePreparationStatus,
  canRoleSetOrderStatus,
  itemTransitions,
  orderTransitions,
} from "./order.policy.js";
import type {
  IdempotencyRecord,
  ItemStatusChange,
  MenuItemForOrder,
  OrderHistoryRecord,
  OrderRecord,
  OrderRepository,
  OrderActor,
  OrderTransaction,
  OrderWriteItem,
} from "./order.repository.js";
import {
  NoopRealtimePublisher,
  type RealtimePublisher,
} from "../realtime/realtime.publisher.js";

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_DATABASE_INTEGER = 2_147_483_647;

export interface OrderServiceContract {
  createOrder(
    restaurantId: string,
    actorMembershipId: string,
    idempotencyKey: string,
    input: CreateOrderRequest,
  ): Promise<Order>;
  createCustomerOrder(
    restaurantId: string,
    customerOrderingSessionId: string,
    tableSessionId: string,
    idempotencyKey: string,
    input: CustomerCreateOrderRequest,
  ): Promise<Order>;
  listOrders(
    restaurantId: string,
    query: OrderListQuery,
  ): Promise<{
    orders: Order[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>;
  getOrder(restaurantId: string, orderId: string): Promise<Order>;
  listCustomerOrders(
    restaurantId: string,
    customerOrderingSessionId: string,
  ): Promise<Order[]>;
  getCustomerOrder(
    restaurantId: string,
    customerOrderingSessionId: string,
    orderId: string,
  ): Promise<Order>;
  listKitchenTickets(
    restaurantId: string,
    query: KitchenTicketListQuery,
  ): Promise<{ orders: Order[] }>;
  addItems(
    restaurantId: string,
    actorMembershipId: string,
    orderId: string,
    idempotencyKey: string,
    input: AddOrderItemsRequest,
  ): Promise<Order>;
  updateStatus(
    restaurantId: string,
    actorMembershipId: string,
    role: Role,
    orderId: string,
    input: UpdateOrderStatusRequest,
  ): Promise<Order>;
  updateItemStatus(
    restaurantId: string,
    actorMembershipId: string,
    role: Role,
    itemId: string,
    input: UpdateOrderItemStatusRequest,
  ): Promise<Order>;
  listHistory(
    restaurantId: string,
    orderId: string,
  ): Promise<OrderHistoryEntry[]>;
}

function toOrder(record: OrderRecord): Order {
  return {
    id: record.id,
    tableSessionId: record.tableSessionId,
    table: record.tableSession.table,
    orderNumber: record.orderNumber,
    source: record.source,
    status: record.status,
    version: record.version,
    totalMinor: record.totalMinor,
    createdBy: record.createdBy
      ? {
          id: record.createdBy.id,
          displayName: record.createdBy.user.displayName,
        }
      : {
          id: record.id,
          displayName: "Customer",
        },
    items: record.items.map((item) => ({
      ...item,
      modifiers: item.modifiers,
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
    })),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toHistory(record: OrderHistoryRecord): OrderHistoryEntry {
  return {
    id: record.id,
    previousStatus: record.previousStatus,
    newStatus: record.newStatus,
    actor: record.actor
      ? { id: record.actor.id, displayName: record.actor.user.displayName }
      : {
          id: record.id,
          displayName: "Customer",
        },
    reason: record.reason,
    createdAt: record.createdAt.toISOString(),
  };
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value))
    return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, entry]) => entry !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));
    return `{${entries
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonicalJson(entry)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function requestHash(input: unknown): string {
  return createHash("sha256").update(canonicalJson(input)).digest("hex");
}

function isErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === code
  );
}

function isSerializationConflict(error: unknown): boolean {
  if (isErrorCode(error, "P2034")) return true;
  if (
    typeof error !== "object" ||
    error === null ||
    !("code" in error) ||
    error.code !== "P2010" ||
    !("meta" in error)
  )
    return false;
  return JSON.stringify(error.meta).includes("40001");
}

function replay(
  record: IdempotencyRecord,
  operation: IdempotencyRecord["operation"],
  hash: string,
): Order {
  if (record.operation !== operation || record.requestHash !== hash)
    throw new AppError(
      409,
      "IDEMPOTENCY_KEY_CONFLICT",
      "This idempotency key was already used with a different request.",
    );
  const parsed = orderResponseSchema.safeParse(record.responseBody);
  if (!parsed.success)
    throw new AppError(
      409,
      "IDEMPOTENCY_RESULT_UNAVAILABLE",
      "The original request is not yet available. Retry shortly.",
    );
  return parsed.data.order;
}

function orderNumber(): string {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `RF-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export class OrderService implements OrderServiceContract {
  constructor(
    private readonly repository: OrderRepository,
    private readonly publisher: RealtimePublisher = new NoopRealtimePublisher(),
  ) {}

  async createOrder(
    restaurantId: string,
    actorMembershipId: string,
    idempotencyKey: string,
    input: CreateOrderRequest,
  ) {
    return this.createOrderForActor(
      restaurantId,
      { kind: "staff", id: actorMembershipId },
      "WAITER",
      input.tableSessionId,
      idempotencyKey,
      input.items,
    );
  }

  private async createOrderForActor(
    restaurantId: string,
    actor: OrderActor,
    source: "WAITER" | "CUSTOMER",
    tableSessionId: string,
    idempotencyKey: string,
    inputs: OrderItemInput[],
  ) {
    const result = await this.executeIdempotent(
      restaurantId,
      actor,
      idempotencyKey,
      "CREATE_ORDER",
      { tableSessionId, items: inputs },
      async (transaction) => {
        await this.requireOpenSession(
          transaction,
          restaurantId,
          tableSessionId,
        );
        const items = await this.priceItems(
          transaction,
          restaurantId,
          inputs,
          1,
        );
        return transaction.createOrder({
          restaurantId,
          tableSessionId,
          orderNumber: orderNumber(),
          actor,
          source,
          totalMinor: this.total(items),
          items,
        });
      },
    );
    if (result.changed)
      await this.publish(result.order, restaurantId, "CREATED");
    return result.order;
  }

  createCustomerOrder(
    restaurantId: string,
    customerOrderingSessionId: string,
    tableSessionId: string,
    idempotencyKey: string,
    input: CustomerCreateOrderRequest,
  ) {
    return this.createOrderForActor(
      restaurantId,
      { kind: "customer", id: customerOrderingSessionId },
      "CUSTOMER",
      tableSessionId,
      idempotencyKey,
      input.items,
    );
  }

  async listOrders(restaurantId: string, query: OrderListQuery) {
    const { records, total } = await this.repository.listOrders(
      restaurantId,
      query,
    );
    return {
      orders: records.map(toOrder),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getOrder(restaurantId: string, orderId: string) {
    const order = await this.repository.findOrder(restaurantId, orderId);
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
    return toOrder(order);
  }

  async listCustomerOrders(
    restaurantId: string,
    customerOrderingSessionId: string,
  ) {
    return (
      await this.repository.listCustomerOrders(
        restaurantId,
        customerOrderingSessionId,
      )
    ).map(toOrder);
  }

  async getCustomerOrder(
    restaurantId: string,
    customerOrderingSessionId: string,
    orderId: string,
  ) {
    const order = await this.repository.findCustomerOrder(
      restaurantId,
      customerOrderingSessionId,
      orderId,
    );
    if (!order) throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
    return toOrder(order);
  }

  async listKitchenTickets(
    restaurantId: string,
    query: KitchenTicketListQuery,
  ) {
    const records = await this.repository.listKitchenTickets(
      restaurantId,
      query,
    );
    return { orders: records.map(toOrder) };
  }

  async addItems(
    restaurantId: string,
    actorMembershipId: string,
    orderId: string,
    idempotencyKey: string,
    input: AddOrderItemsRequest,
  ) {
    const result = await this.executeIdempotent(
      restaurantId,
      { kind: "staff", id: actorMembershipId },
      idempotencyKey,
      "ADD_ORDER_ITEMS",
      { orderId, ...input },
      async (transaction) => {
        const current = await transaction.findOrderSummary(
          restaurantId,
          orderId,
        );
        if (!current)
          throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
        await this.requireOpenSession(
          transaction,
          restaurantId,
          current.tableSessionId,
        );
        const locked = await transaction.lockOrder(restaurantId, orderId);
        if (!locked)
          throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
        if (locked.version !== input.version)
          throw this.versionConflict(locked.version);
        if (
          !["PENDING", "ACCEPTED", "PREPARING", "READY"].includes(locked.status)
        )
          throw new AppError(
            409,
            "ORDER_NOT_MODIFIABLE",
            "Items cannot be added to a terminal order.",
          );
        const items = await this.priceItems(
          transaction,
          restaurantId,
          input.items,
          locked.maximumBatch + 1,
        );
        const additionalTotal = this.total(items);
        if (locked.totalMinor + additionalTotal > MAX_DATABASE_INTEGER)
          throw new AppError(
            400,
            "ORDER_TOTAL_LIMIT",
            "The order total exceeds the supported limit.",
          );
        const updated = await transaction.addItems({
          restaurantId,
          orderId,
          expectedVersion: input.version,
          totalMinor: additionalTotal,
          items,
          actorMembershipId,
          previousStatus: locked.status,
          newStatus: locked.status === "READY" ? "PREPARING" : locked.status,
        });
        if (!updated) throw this.versionConflict(locked.version);
        return updated;
      },
    );
    if (result.changed)
      await this.publish(result.order, restaurantId, "ITEMS_ADDED");
    return result.order;
  }

  async updateStatus(
    restaurantId: string,
    actorMembershipId: string,
    role: Role,
    orderId: string,
    input: UpdateOrderStatusRequest,
  ) {
    if (!canRoleSetOrderStatus(role, input.status))
      throw new AppError(
        403,
        "ORDER_STATUS_FORBIDDEN",
        "Your staff role cannot perform this order status change.",
      );
    try {
      const record = await this.repository.transaction(async (transaction) => {
        const locked = await transaction.lockOrder(restaurantId, orderId);
        if (!locked)
          throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
        if (locked.version !== input.version)
          throw this.versionConflict(locked.version);
        if (
          role === "WAITER" &&
          input.status === "CANCELLED" &&
          locked.status !== "PENDING" &&
          locked.status !== "ACCEPTED"
        )
          throw new AppError(
            403,
            "ORDER_STATUS_FORBIDDEN",
            "Waiters can only cancel pending or accepted orders.",
          );
        if (!orderTransitions[locked.status].includes(input.status))
          throw new AppError(
            409,
            "INVALID_ORDER_STATUS_TRANSITION",
            `An order cannot move from ${locked.status} to ${input.status}.`,
          );
        const itemChanges = this.itemChangesForOrderStatus(
          locked.items,
          input.status,
        );
        const updated = await transaction.applyStatusChanges({
          restaurantId,
          orderId,
          expectedVersion: input.version,
          previousStatus: locked.status,
          newStatus: input.status,
          actorMembershipId,
          reason: input.reason ?? null,
          itemChanges,
        });
        if (!updated) throw this.versionConflict(locked.version);
        return updated;
      });
      const order = toOrder(record);
      await this.publish(order, restaurantId, "STATUS_UPDATED");
      return order;
    } catch (error) {
      if (isSerializationConflict(error)) throw this.concurrentConflict();
      throw error;
    }
  }

  async updateItemStatus(
    restaurantId: string,
    actorMembershipId: string,
    role: Role,
    itemId: string,
    input: UpdateOrderItemStatusRequest,
  ) {
    if (
      !["ADMIN", "MANAGER", "KITCHEN"].includes(role) ||
      (input.status === "CANCELLED" && role === "KITCHEN") ||
      !["PREPARING", "READY", "CANCELLED"].includes(input.status)
    )
      throw new AppError(
        403,
        "ORDER_ITEM_STATUS_FORBIDDEN",
        "Your staff role cannot perform this item status change.",
      );

    const orderId = await this.repository.findOrderIdByItem(
      restaurantId,
      itemId,
    );
    if (!orderId)
      throw new AppError(404, "ORDER_ITEM_NOT_FOUND", "Order item not found.");

    try {
      const record = await this.repository.transaction(async (transaction) => {
        const locked = await transaction.lockOrder(restaurantId, orderId);
        if (!locked)
          throw new AppError(404, "ORDER_NOT_FOUND", "Order not found.");
        if (locked.version !== input.version)
          throw this.versionConflict(locked.version);
        if (!["ACCEPTED", "PREPARING", "READY"].includes(locked.status))
          throw new AppError(
            409,
            "ORDER_ITEM_NOT_MODIFIABLE",
            "Items cannot be changed for this order status.",
          );
        const item = locked.items.find((candidate) => candidate.id === itemId);
        if (!item)
          throw new AppError(
            404,
            "ORDER_ITEM_NOT_FOUND",
            "Order item not found.",
          );
        if (!itemTransitions[item.status].includes(input.status))
          throw new AppError(
            409,
            "INVALID_ORDER_ITEM_STATUS_TRANSITION",
            `An item cannot move from ${item.status} to ${input.status}.`,
          );

        const nextStatuses = locked.items.map((candidate) =>
          candidate.id === itemId ? input.status : candidate.status,
        );
        const nextOrderStatus = aggregatePreparationStatus(
          locked.status,
          nextStatuses,
        );
        const updated = await transaction.applyStatusChanges({
          restaurantId,
          orderId,
          expectedVersion: input.version,
          previousStatus: locked.status,
          newStatus: nextOrderStatus,
          actorMembershipId,
          reason: input.reason ?? `Item moved to ${input.status}`,
          itemChanges: [
            {
              itemId,
              previousStatus: item.status,
              newStatus: input.status,
            },
          ],
        });
        if (!updated) throw this.versionConflict(locked.version);
        return updated;
      });
      const order = toOrder(record);
      await this.publish(order, restaurantId, "ITEM_UPDATED");
      return order;
    } catch (error) {
      if (isSerializationConflict(error)) throw this.concurrentConflict();
      throw error;
    }
  }

  async listHistory(restaurantId: string, orderId: string) {
    await this.getOrder(restaurantId, orderId);
    return (await this.repository.listHistory(restaurantId, orderId)).map(
      toHistory,
    );
  }

  private async executeIdempotent(
    restaurantId: string,
    actor: OrderActor,
    key: string,
    operation: IdempotencyRecord["operation"],
    input: unknown,
    work: (transaction: OrderTransaction) => Promise<OrderRecord>,
  ): Promise<{ order: Order; changed: boolean }> {
    const hash = requestHash(input);
    const existing = await this.repository.findIdempotency(
      restaurantId,
      actor,
      key,
    );
    if (existing)
      return { order: replay(existing, operation, hash), changed: false };

    try {
      return await this.repository.transaction(async (transaction) => {
        const inTransaction = await transaction.findIdempotency(
          restaurantId,
          actor,
          key,
        );
        if (inTransaction)
          return {
            order: replay(inTransaction, operation, hash),
            changed: false,
          };
        await transaction.reserveIdempotency({
          restaurantId,
          actor,
          key,
          operation,
          requestHash: hash,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        });
        const order = toOrder(await work(transaction));
        const response = { order };
        await transaction.completeIdempotency(
          restaurantId,
          actor,
          key,
          order.id,
          response,
        );
        return { order, changed: true };
      });
    } catch (error) {
      if (isErrorCode(error, "P2002") || isSerializationConflict(error)) {
        const concurrent = await this.repository.findIdempotency(
          restaurantId,
          actor,
          key,
        );
        if (concurrent)
          return {
            order: replay(concurrent, operation, hash),
            changed: false,
          };
        if (isSerializationConflict(error)) throw this.concurrentConflict();
      }
      throw error;
    }
  }

  private itemChangesForOrderStatus(
    items: readonly {
      id: string;
      status: ItemStatusChange["previousStatus"];
    }[],
    target: UpdateOrderStatusRequest["status"],
  ): ItemStatusChange[] {
    if (target === "PREPARING") {
      return items
        .filter((item) => item.status === "PENDING")
        .map((item) => ({
          itemId: item.id,
          previousStatus: item.status,
          newStatus: "PREPARING",
        }));
    }
    if (target === "READY") {
      const active = items.filter((item) => item.status !== "CANCELLED");
      if (
        active.length === 0 ||
        active.some(
          (item) => item.status !== "PREPARING" && item.status !== "READY",
        )
      )
        throw new AppError(
          409,
          "ORDER_ITEMS_NOT_READY",
          "Every active item must be preparing or ready before completing the ticket.",
        );
      return active
        .filter((item) => item.status === "PREPARING")
        .map((item) => ({
          itemId: item.id,
          previousStatus: item.status,
          newStatus: "READY",
        }));
    }
    if (target === "CANCELLED" || target === "REJECTED") {
      return items
        .filter(
          (item) => item.status !== "CANCELLED" && item.status !== "SERVED",
        )
        .map((item) => ({
          itemId: item.id,
          previousStatus: item.status,
          newStatus: "CANCELLED",
        }));
    }
    if (target === "SERVED") {
      return items
        .filter((item) => item.status === "READY")
        .map((item) => ({
          itemId: item.id,
          previousStatus: item.status,
          newStatus: "SERVED",
        }));
    }
    return [];
  }

  private async publish(
    order: Order,
    restaurantId: string,
    changeType: Parameters<RealtimePublisher["orderChanged"]>[0]["changeType"],
  ) {
    const customerOrderingSessionId =
      await this.repository.findOrderCustomerSessionId(restaurantId, order.id);
    return this.publisher.orderChanged({
      restaurantId,
      orderId: order.id,
      orderVersion: order.version,
      changeType,
      customerOrderingSessionId,
    });
  }

  private async requireOpenSession(
    transaction: OrderTransaction,
    restaurantId: string,
    tableSessionId: string,
  ) {
    const session = await transaction.lockTableSession(
      restaurantId,
      tableSessionId,
    );
    if (!session)
      throw new AppError(
        404,
        "TABLE_SESSION_NOT_FOUND",
        "Table session not found.",
      );
    if (session.status !== "OPEN" || session.closedAt)
      throw new AppError(
        409,
        "TABLE_SESSION_CLOSED",
        "Closed table sessions cannot accept orders.",
      );
    return session;
  }

  private async priceItems(
    transaction: OrderTransaction,
    restaurantId: string,
    inputs: OrderItemInput[],
    batchNumber: number,
  ): Promise<OrderWriteItem[]> {
    const records = await transaction.findMenuItems(restaurantId, [
      ...new Set(inputs.map((item) => item.menuItemId)),
    ]);
    const byId = new Map(records.map((record) => [record.id, record]));
    return inputs.map((input) => {
      const item = byId.get(input.menuItemId);
      if (
        !item ||
        !item.isActive ||
        !item.isAvailable ||
        !item.category.isActive
      )
        throw new AppError(
          409,
          "MENU_ITEM_UNAVAILABLE",
          "One or more menu items are unavailable.",
          { menuItemId: input.menuItemId },
        );
      return this.priceItem(item, input, batchNumber);
    });
  }

  private priceItem(
    item: MenuItemForOrder,
    input: OrderItemInput,
    batchNumber: number,
  ): OrderWriteItem {
    const selected = new Set(input.modifierIds);
    const modifiers: OrderWriteItem["modifiers"] = [];
    for (const assignment of item.modifierGroups) {
      const group = assignment.modifierGroup;
      if (!group.isActive) {
        if (group.minSelections > 0)
          throw new AppError(
            409,
            "MENU_ITEM_UNAVAILABLE",
            "A required modifier group is unavailable.",
            { menuItemId: item.id, modifierGroupId: group.id },
          );
        continue;
      }
      const groupSelections = group.modifiers.filter((modifier) =>
        selected.has(modifier.id),
      );
      if (
        groupSelections.length < group.minSelections ||
        groupSelections.length > group.maxSelections
      )
        throw new AppError(
          400,
          "INVALID_MODIFIER_SELECTION",
          `Select between ${group.minSelections} and ${group.maxSelections} options for ${group.name}.`,
          { menuItemId: item.id, modifierGroupId: group.id },
        );
      for (const modifier of groupSelections) {
        if (!modifier.isAvailable)
          throw new AppError(
            409,
            "MODIFIER_UNAVAILABLE",
            "A selected modifier is unavailable.",
            { modifierId: modifier.id },
          );
        selected.delete(modifier.id);
        modifiers.push({
          modifierGroupId: group.id,
          modifierId: modifier.id,
          modifierGroupNameSnapshot: group.name,
          modifierNameSnapshot: modifier.name,
          modifierPriceMinor: modifier.priceDeltaMinor,
        });
      }
    }
    if (selected.size > 0)
      throw new AppError(
        400,
        "INVALID_MODIFIER_SELECTION",
        "A selected modifier is not assigned to this menu item.",
        { menuItemId: item.id, modifierIds: [...selected] },
      );
    const unitWithModifiers =
      item.priceMinor +
      modifiers.reduce((sum, modifier) => sum + modifier.modifierPriceMinor, 0);
    const lineTotalMinor = unitWithModifiers * input.quantity;
    if (lineTotalMinor > MAX_DATABASE_INTEGER)
      throw new AppError(
        400,
        "ORDER_TOTAL_LIMIT",
        "An order line exceeds the supported limit.",
      );
    return {
      id: randomUUID(),
      menuItemId: item.id,
      itemNameSnapshot: item.name,
      quantity: input.quantity,
      unitPriceMinor: item.priceMinor,
      lineTotalMinor,
      specialInstructions: input.specialInstructions ?? null,
      batchNumber,
      modifiers,
    };
  }

  private total(items: OrderWriteItem[]) {
    const total = items.reduce((sum, item) => sum + item.lineTotalMinor, 0);
    if (total > MAX_DATABASE_INTEGER)
      throw new AppError(
        400,
        "ORDER_TOTAL_LIMIT",
        "The order total exceeds the supported limit.",
      );
    return total;
  }

  private versionConflict(currentVersion: number) {
    return new AppError(
      409,
      "ORDER_VERSION_CONFLICT",
      "The order changed since it was loaded. Refresh and try again.",
      { currentVersion },
    );
  }

  private concurrentConflict() {
    return new AppError(
      409,
      "ORDER_VERSION_CONFLICT",
      "The order changed during this request. Refresh and try again.",
    );
  }
}
