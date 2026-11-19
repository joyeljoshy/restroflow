import {
  activeBillingSessionListResponseSchema,
  billListResponseSchema,
  billPreviewResponseSchema,
  billResponseSchema,
  paymentListResponseSchema,
  paymentResponseSchema,
  type Bill,
  type BillListQuery,
  type BillPreview,
  type CreatePaymentRequest,
} from "@restroflow/contracts";

import { apiError, apiUrl } from "./auth-api";

async function billingRequest(
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

export async function fetchActiveBillingSessions(restaurantId: string) {
  const response = await billingRequest(
    restaurantId,
    "/api/v1/billing/active-sessions",
  );
  return activeBillingSessionListResponseSchema.parse(await response.json())
    .sessions;
}

export async function fetchBillPreview(
  restaurantId: string,
  tableSessionId: string,
): Promise<BillPreview> {
  const response = await billingRequest(
    restaurantId,
    `/api/v1/table-sessions/${tableSessionId}/bill-preview`,
  );
  return billPreviewResponseSchema.parse(await response.json()).preview;
}

export async function finalizeBill(
  restaurantId: string,
  tableSessionId: string,
): Promise<Bill> {
  const response = await billingRequest(
    restaurantId,
    `/api/v1/table-sessions/${tableSessionId}/bills`,
    { method: "POST" },
  );
  return billResponseSchema.parse(await response.json()).bill;
}

export async function fetchBill(
  restaurantId: string,
  billId: string,
): Promise<Bill> {
  const response = await billingRequest(
    restaurantId,
    `/api/v1/bills/${billId}`,
  );
  return billResponseSchema.parse(await response.json()).bill;
}

export async function fetchBills(
  restaurantId: string,
  query: Partial<BillListQuery> = {},
) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined) params.set(key, String(value));
  const response = await billingRequest(
    restaurantId,
    `/api/v1/bills?${params.toString()}`,
  );
  return billListResponseSchema.parse(await response.json());
}

export async function recordPayment(
  restaurantId: string,
  billId: string,
  idempotencyKey: string,
  input: CreatePaymentRequest,
) {
  const response = await billingRequest(
    restaurantId,
    `/api/v1/bills/${billId}/payments`,
    {
      method: "POST",
      headers: { "idempotency-key": idempotencyKey },
      body: JSON.stringify(input),
    },
  );
  return paymentResponseSchema.parse(await response.json());
}

export async function fetchPayments(restaurantId: string, billId: string) {
  const response = await billingRequest(
    restaurantId,
    `/api/v1/bills/${billId}/payments`,
  );
  return paymentListResponseSchema.parse(await response.json()).payments;
}
