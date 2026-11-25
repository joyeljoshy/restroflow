import {
  customerOrderListResponseSchema,
  customerOrderResponseSchema,
  customerSessionResponseSchema,
  publicTableMenuResponseSchema,
  publicTableResponseSchema,
  type CustomerCreateOrderRequest,
  type CustomerOrder,
  type CustomerSession,
} from "@restroflow/contracts";

import { apiError } from "./auth-api";

async function publicRequest(path: string, init?: RequestInit) {
  const response = await fetch(`/api/customer${path}`, {
    cache: "no-store",
    ...init,
    credentials: "same-origin",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw await apiError(response);
  return response;
}

export async function fetchPublicTable(identifier: string) {
  const response = await publicRequest(
    `/tables/${encodeURIComponent(identifier)}`,
  );
  return publicTableResponseSchema.parse(await response.json()).context;
}

export async function fetchPublicMenu(identifier: string) {
  const response = await publicRequest(
    `/tables/${encodeURIComponent(identifier)}/menu`,
  );
  return publicTableMenuResponseSchema.parse(await response.json());
}

export async function activateCustomerSession(
  identifier: string,
  activationCode: string,
): Promise<CustomerSession> {
  const response = await publicRequest("/table-access/activate", {
    method: "POST",
    body: JSON.stringify({ identifier, activationCode }),
  });
  return customerSessionResponseSchema.parse(await response.json()).session;
}

export async function fetchCustomerSession(
  signal?: AbortSignal,
): Promise<CustomerSession> {
  const response = await publicRequest("/customer-session", {
    signal,
  });
  return customerSessionResponseSchema.parse(await response.json()).session;
}

export async function logoutCustomerSession() {
  await publicRequest("/customer-session/logout", {
    method: "POST",
  });
}

export async function createCustomerOrder(
  key: string,
  input: CustomerCreateOrderRequest,
): Promise<CustomerOrder> {
  const response = await publicRequest("/orders", {
    method: "POST",
    headers: { "idempotency-key": key },
    body: JSON.stringify(input),
  });
  return customerOrderResponseSchema.parse(await response.json()).order;
}

export async function fetchCustomerOrders(
  signal?: AbortSignal,
): Promise<CustomerOrder[]> {
  const response = await publicRequest("/orders", { signal });
  return customerOrderListResponseSchema.parse(await response.json()).orders;
}

export async function fetchCustomerOrder(orderId: string) {
  const response = await publicRequest(
    `/orders/${encodeURIComponent(orderId)}`,
  );
  return customerOrderResponseSchema.parse(await response.json()).order;
}
