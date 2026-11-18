import {
  menuCategoryListResponseSchema,
  menuCategoryResponseSchema,
  menuImageResponseSchema,
  menuItemListResponseSchema,
  menuItemResponseSchema,
  modifierGroupListResponseSchema,
  modifierGroupResponseSchema,
  modifierResponseSchema,
  type AssignModifierGroupsRequest,
  type CreateMenuCategoryRequest,
  type CreateMenuItemRequest,
  type CreateModifierGroupRequest,
  type CreateModifierRequest,
  type MenuCategory,
  type MenuItem,
  type MenuItemListQuery,
  type MenuItemListResponse,
  type Modifier,
  type ModifierGroup,
  type UpdateMenuCategoryRequest,
  type UpdateMenuItemRequest,
  type UpdateModifierGroupRequest,
  type UpdateModifierRequest,
} from "@restroflow/contracts";

import { apiError, apiUrl } from "./auth-api";

async function request(
  restaurantId: string,
  input: string,
  init?: RequestInit,
): Promise<Response> {
  const response = await fetch(`${apiUrl}${input}`, {
    ...init,
    credentials: "include",
    headers: {
      "x-restaurant-id": restaurantId,
      ...(init?.body && typeof init.body === "string"
        ? { "content-type": "application/json" }
        : {}),
      ...init?.headers,
    },
  });
  if (!response.ok) throw await apiError(response);
  return response;
}

export async function fetchMenuCategories(
  restaurantId: string,
  includeInactive = true,
) {
  const response = await request(
    restaurantId,
    `/api/v1/menu/categories?includeInactive=${includeInactive}`,
  );
  return menuCategoryListResponseSchema.parse(await response.json()).categories;
}
export async function createMenuCategory(
  restaurantId: string,
  input: CreateMenuCategoryRequest,
) {
  const response = await request(restaurantId, "/api/v1/menu/categories", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return menuCategoryResponseSchema.parse(await response.json()).category;
}
export async function updateMenuCategory(
  restaurantId: string,
  id: string,
  input: UpdateMenuCategoryRequest,
) {
  const response = await request(
    restaurantId,
    `/api/v1/menu/categories/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return menuCategoryResponseSchema.parse(await response.json()).category;
}
export async function deactivateMenuCategory(restaurantId: string, id: string) {
  const response = await request(
    restaurantId,
    `/api/v1/menu/categories/${id}`,
    { method: "DELETE" },
  );
  return menuCategoryResponseSchema.parse(await response.json()).category;
}

export async function fetchMenuItems(
  restaurantId: string,
  query: Partial<MenuItemListQuery>,
): Promise<MenuItemListResponse> {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query))
    if (value !== undefined && value !== "") params.set(key, String(value));
  const response = await request(
    restaurantId,
    `/api/v1/menu/items?${params.toString()}`,
  );
  return menuItemListResponseSchema.parse(await response.json());
}
export async function createMenuItem(
  restaurantId: string,
  input: CreateMenuItemRequest,
): Promise<MenuItem> {
  const response = await request(restaurantId, "/api/v1/menu/items", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return menuItemResponseSchema.parse(await response.json()).item;
}
export async function updateMenuItem(
  restaurantId: string,
  id: string,
  input: UpdateMenuItemRequest,
): Promise<MenuItem> {
  const response = await request(restaurantId, `/api/v1/menu/items/${id}`, {
    method: "PATCH",
    body: JSON.stringify(input),
  });
  return menuItemResponseSchema.parse(await response.json()).item;
}
export async function updateMenuItemAvailability(
  restaurantId: string,
  id: string,
  isAvailable: boolean,
): Promise<MenuItem> {
  const response = await request(
    restaurantId,
    `/api/v1/menu/items/${id}/availability`,
    { method: "PATCH", body: JSON.stringify({ isAvailable }) },
  );
  return menuItemResponseSchema.parse(await response.json()).item;
}
export async function deactivateMenuItem(
  restaurantId: string,
  id: string,
): Promise<MenuItem> {
  const response = await request(restaurantId, `/api/v1/menu/items/${id}`, {
    method: "DELETE",
  });
  return menuItemResponseSchema.parse(await response.json()).item;
}
export async function assignMenuItemModifierGroups(
  restaurantId: string,
  id: string,
  input: AssignModifierGroupsRequest,
): Promise<MenuItem> {
  const response = await request(
    restaurantId,
    `/api/v1/menu/items/${id}/modifier-groups`,
    { method: "PUT", body: JSON.stringify(input) },
  );
  return menuItemResponseSchema.parse(await response.json()).item;
}

export async function fetchModifierGroups(
  restaurantId: string,
  includeInactive = true,
): Promise<ModifierGroup[]> {
  const response = await request(
    restaurantId,
    `/api/v1/menu/modifier-groups?includeInactive=${includeInactive}`,
  );
  return modifierGroupListResponseSchema.parse(await response.json()).groups;
}
export async function createModifierGroup(
  restaurantId: string,
  input: CreateModifierGroupRequest,
): Promise<ModifierGroup> {
  const response = await request(restaurantId, "/api/v1/menu/modifier-groups", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return modifierGroupResponseSchema.parse(await response.json()).group;
}
export async function updateModifierGroup(
  restaurantId: string,
  id: string,
  input: UpdateModifierGroupRequest,
): Promise<ModifierGroup> {
  const response = await request(
    restaurantId,
    `/api/v1/menu/modifier-groups/${id}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return modifierGroupResponseSchema.parse(await response.json()).group;
}
export async function deactivateModifierGroup(
  restaurantId: string,
  id: string,
): Promise<ModifierGroup> {
  const response = await request(
    restaurantId,
    `/api/v1/menu/modifier-groups/${id}`,
    { method: "DELETE" },
  );
  return modifierGroupResponseSchema.parse(await response.json()).group;
}
export async function createModifier(
  restaurantId: string,
  groupId: string,
  input: CreateModifierRequest,
): Promise<Modifier> {
  const response = await request(
    restaurantId,
    `/api/v1/menu/modifier-groups/${groupId}/modifiers`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return modifierResponseSchema.parse(await response.json()).modifier;
}
export async function updateModifier(
  restaurantId: string,
  groupId: string,
  modifierId: string,
  input: UpdateModifierRequest,
): Promise<Modifier> {
  const response = await request(
    restaurantId,
    `/api/v1/menu/modifier-groups/${groupId}/modifiers/${modifierId}`,
    { method: "PATCH", body: JSON.stringify(input) },
  );
  return modifierResponseSchema.parse(await response.json()).modifier;
}

export async function uploadMenuImage(
  restaurantId: string,
  file: File,
): Promise<string> {
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  if (file.size === 0 || file.size > 3 * 1024 * 1024)
    throw new Error("Images must be smaller than 3 MB.");
  const response = await request(restaurantId, "/api/v1/menu/images", {
    method: "POST",
    headers: { "content-type": file.type },
    body: file,
  });
  return menuImageResponseSchema.parse(await response.json()).imageUrl;
}

export function resolveMenuImageUrl(imageUrl: string | null): string | null {
  if (!imageUrl) return null;
  return imageUrl.startsWith("/") ? `${apiUrl}${imageUrl}` : imageUrl;
}

export type { MenuCategory };
