import {
  restaurantResponseSchema,
  staffListResponseSchema,
  staffResponseSchema,
  type CreateStaffRequest,
  type Restaurant,
  type StaffListQuery,
  type StaffListResponse,
  type StaffMember,
  type UpdateRestaurantRequest,
  type UpdateStaffRequest,
} from "@restroflow/contracts";

import { apiError, apiUrl } from "./auth-api";

async function request(input: string, init?: RequestInit): Promise<Response> {
  const response = await fetch(`${apiUrl}${input}`, {
    ...init,
    credentials: "include",
    headers: {
      ...(init?.body ? { "content-type": "application/json" } : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw await apiError(response);
  return response;
}

export async function fetchRestaurant(
  restaurantId: string,
): Promise<Restaurant> {
  const response = await request(`/api/v1/restaurants/${restaurantId}`);
  return restaurantResponseSchema.parse(await response.json()).restaurant;
}

export async function updateRestaurant(
  restaurantId: string,
  input: UpdateRestaurantRequest,
): Promise<Restaurant> {
  const response = await request(`/api/v1/restaurants/${restaurantId}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return restaurantResponseSchema.parse(await response.json()).restaurant;
}

export async function fetchStaff(
  restaurantId: string,
  query: StaffListQuery,
): Promise<StaffListResponse> {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.role) params.set("role", query.role);
  params.set("status", query.status);
  const response = await request(
    `/api/v1/restaurants/${restaurantId}/staff?${params.toString()}`,
  );
  return staffListResponseSchema.parse(await response.json());
}

export async function createStaff(
  restaurantId: string,
  input: CreateStaffRequest,
): Promise<StaffMember> {
  const response = await request(`/api/v1/restaurants/${restaurantId}/staff`, {
    method: "POST",
    body: JSON.stringify(input),
  });
  return staffResponseSchema.parse(await response.json()).staffMember;
}

export async function updateStaff(
  restaurantId: string,
  staffId: string,
  input: UpdateStaffRequest,
): Promise<StaffMember> {
  const response = await request(
    `/api/v1/restaurants/${restaurantId}/staff/${staffId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return staffResponseSchema.parse(await response.json()).staffMember;
}
