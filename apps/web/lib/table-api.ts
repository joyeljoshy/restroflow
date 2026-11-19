import {
  tableListResponseSchema,
  tableQrCodeResponseSchema,
  tableResponseSchema,
  tableSessionListResponseSchema,
  tableSessionResponseSchema,
  type CreateTableRequest,
  type RestaurantTable,
  type TableListQuery,
  type TableQrCode,
  type TableSession,
  tableOrderingActivationResponseSchema,
  type UpdateTableRequest,
} from "@restroflow/contracts";

import { apiError, apiUrl } from "./auth-api";

async function tableRequest(
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

export async function fetchTables(
  restaurantId: string,
  query: Partial<TableListQuery> = {},
): Promise<RestaurantTable[]> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.occupancy) params.set("occupancy", query.occupancy);
  const response = await tableRequest(
    restaurantId,
    `/api/v1/tables?${params.toString()}`,
  );
  return tableListResponseSchema.parse(await response.json()).tables;
}

export async function createTable(
  restaurantId: string,
  input: CreateTableRequest,
): Promise<RestaurantTable> {
  const response = await tableRequest(restaurantId, "/api/v1/tables", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return tableResponseSchema.parse(await response.json()).table;
}

export async function updateTable(
  restaurantId: string,
  tableId: string,
  input: UpdateTableRequest,
): Promise<RestaurantTable> {
  const response = await tableRequest(
    restaurantId,
    `/api/v1/tables/${tableId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return tableResponseSchema.parse(await response.json()).table;
}

export async function deactivateTable(
  restaurantId: string,
  tableId: string,
): Promise<RestaurantTable> {
  const response = await tableRequest(
    restaurantId,
    `/api/v1/tables/${tableId}`,
    { method: "DELETE" },
  );
  return tableResponseSchema.parse(await response.json()).table;
}

export async function openTableSession(
  restaurantId: string,
  tableId: string,
): Promise<TableSession> {
  const response = await tableRequest(
    restaurantId,
    `/api/v1/tables/${tableId}/sessions`,
    { method: "POST" },
  );
  return tableSessionResponseSchema.parse(await response.json()).session;
}

export async function closeTableSession(
  restaurantId: string,
  sessionId: string,
): Promise<TableSession> {
  const response = await tableRequest(
    restaurantId,
    `/api/v1/table-sessions/${sessionId}/close`,
    { method: "POST" },
  );
  return tableSessionResponseSchema.parse(await response.json()).session;
}

export async function fetchTableSessions(
  restaurantId: string,
  tableId: string,
): Promise<TableSession[]> {
  const response = await tableRequest(
    restaurantId,
    `/api/v1/tables/${tableId}/sessions`,
  );
  return tableSessionListResponseSchema.parse(await response.json()).sessions;
}

export async function fetchTableQrCode(
  restaurantId: string,
  tableId: string,
): Promise<TableQrCode> {
  const response = await tableRequest(
    restaurantId,
    `/api/v1/tables/${tableId}/qr`,
  );
  return tableQrCodeResponseSchema.parse(await response.json()).qrCode;
}

export async function rotateTableQrCode(
  restaurantId: string,
  tableId: string,
): Promise<TableQrCode> {
  const response = await tableRequest(
    restaurantId,
    `/api/v1/tables/${tableId}/qr/rotate`,
    { method: "POST" },
  );
  return tableQrCodeResponseSchema.parse(await response.json()).qrCode;
}

export async function issueTableOrderingActivation(
  restaurantId: string,
  tableSessionId: string,
) {
  const response = await tableRequest(
    restaurantId,
    `/api/v1/table-sessions/${tableSessionId}/customer-access`,
    { method: "POST" },
  );
  return tableOrderingActivationResponseSchema.parse(await response.json())
    .activation;
}
