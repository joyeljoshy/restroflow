import {
  orderHistoryResponseSchema,
  kitchenTicketListResponseSchema,
  orderListResponseSchema,
  orderResponseSchema,
  type AddOrderItemsRequest,
  type CreateOrderRequest,
  type Order,
  type OrderHistoryEntry,
  type OrderListQuery,
  type OrderItemStatus,
  type UpdateOrderStatusRequest,
} from "@restroflow/contracts";

import { apiError, apiUrl } from "./auth-api";

async function orderRequest(
  restaurantId: string,
  path: string,
  init?: RequestInit,
) {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    credentials: "include",
    headers: {
      "x-restaurant-id": restaurantId,
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw await apiError(response);
  return response;
}

export async function createOrder(
  restaurantId: string,
  idempotencyKey: string,
  input: CreateOrderRequest,
): Promise<Order> {
  const response = await orderRequest(restaurantId, "/api/v1/orders", {
    method: "POST",
    headers: { "idempotency-key": idempotencyKey },
    body: JSON.stringify(input),
  });
  return orderResponseSchema.parse(await response.json()).order;
}

export async function fetchOrders(
  restaurantId: string,
  query: Partial<OrderListQuery> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) params.set(key, String(value));
  const response = await orderRequest(
    restaurantId,
    `/api/v1/orders?${params.toString()}`,
  );
  return orderListResponseSchema.parse(await response.json());
}

export async function fetchOrder(
  restaurantId: string,
  orderId: string,
): Promise<Order> {
  const response = await orderRequest(
    restaurantId,
    `/api/v1/orders/${orderId}`,
  );
  return orderResponseSchema.parse(await response.json()).order;
}

export async function addOrderItems(
  restaurantId: string,
  orderId: string,
  idempotencyKey: string,
  input: AddOrderItemsRequest,
): Promise<Order> {
  const response = await orderRequest(
    restaurantId,
    `/api/v1/orders/${orderId}/items`,
    {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    },
  );
  return orderResponseSchema.parse(await response.json()).order;
}

export async function updateOrderStatus(
  restaurantId: string,
  orderId: string,
  input: UpdateOrderStatusRequest,
): Promise<Order> {
  const response = await orderRequest(
    restaurantId,
    `/api/v1/orders/${orderId}/status`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return orderResponseSchema.parse(await response.json()).order;
}

export async function fetchOrderHistory(
  restaurantId: string,
  orderId: string,
): Promise<OrderHistoryEntry[]> {
  const response = await orderRequest(
    restaurantId,
    `/api/v1/orders/${orderId}/history`,
  );
  return orderHistoryResponseSchema.parse(await response.json()).history;
}

export async function fetchKitchenTickets(
  restaurantId: string,
  statuses: Order["status"][] = ["PENDING", "ACCEPTED", "PREPARING", "READY"],
) {
  const params = new URLSearchParams({
    limit: "100",
    statuses: statuses.join(","),
  });
  const response = await orderRequest(
    restaurantId,
    `/api/v1/kitchen/tickets?${params.toString()}`,
  );
  return kitchenTicketListResponseSchema.parse(await response.json()).orders;
}

export async function updateKitchenOrderStatus(
  restaurantId: string,
  orderId: string,
  input: UpdateOrderStatusRequest,
) {
  const response = await orderRequest(
    restaurantId,
    `/api/v1/kitchen/orders/${orderId}/status`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return orderResponseSchema.parse(await response.json()).order;
}

export async function updateKitchenItemStatus(
  restaurantId: string,
  itemId: string,
  input: { version: number; status: OrderItemStatus; reason?: string },
) {
  const response = await orderRequest(
    restaurantId,
    `/api/v1/kitchen/items/${itemId}/status`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return orderResponseSchema.parse(await response.json()).order;
}
