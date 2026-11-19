import {
  AssignModifierGroupsRequest,
  AuthenticatedUser,
  CreateMenuCategoryRequest,
  CreateMenuItemRequest,
  CreateModifierGroupRequest,
  CreateModifierRequest,
  MenuItemListQuery,
  menuCategoryResponseSchema,
  menuItemListResponseSchema,
  menuItemResponseSchema,
  modifierGroupResponseSchema,
  Role,
  UpdateMenuCategoryRequest,
  UpdateMenuItemRequest,
  UpdateModifierGroupRequest,
  UpdateModifierRequest,
} from "@restroflow/contracts";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import type {
  CategoryRecord,
  MenuItemRecord,
  MenuRepository,
  ModifierGroupRecord,
} from "./menu.repository.js";
import { MenuService } from "./menu.service.js";

const restaurantId = "9010e67f-4aa1-428e-bc26-6de08366aab2";
const otherRestaurantId = "ab88f4ee-d8e4-4dc6-8400-99ee336983e7";
const fixedDate = new Date("2026-11-18T10:00:00.000Z");

class MemoryMenuRepository implements MenuRepository {
  categories: (CategoryRecord & { restaurantId: string })[] = [];
  items: (Omit<MenuItemRecord, "category" | "modifierGroups"> & {
    restaurantId: string;
  })[] = [];
  groups: (ModifierGroupRecord & { restaurantId: string })[] = [];
  assignments: {
    restaurantId: string;
    itemId: string;
    groupId: string;
    sortOrder: number;
  }[] = [];
  private sequence = 0;

  private id() {
    this.sequence += 1;
    return `10000000-0000-4000-8000-${this.sequence.toString().padStart(12, "0")}`;
  }

  listCategories(scope: string, includeInactive: boolean) {
    return Promise.resolve(
      this.categories
        .filter(
          (item) =>
            item.restaurantId === scope && (includeInactive || item.isActive),
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
  }
  findCategory(scope: string, id: string) {
    return Promise.resolve(
      this.categories.find(
        (item) => item.restaurantId === scope && item.id === id,
      ) ?? null,
    );
  }
  createCategory(scope: string, input: CreateMenuCategoryRequest) {
    if (
      this.categories.some(
        (item) => item.restaurantId === scope && item.name === input.name,
      )
    )
      return Promise.reject(
        Object.assign(new Error("Duplicate category"), { code: "P2002" }),
      );
    const record = {
      id: this.id(),
      restaurantId: scope,
      description: null,
      ...input,
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };
    this.categories.push(record);
    return Promise.resolve(record);
  }
  async updateCategory(
    scope: string,
    id: string,
    input: UpdateMenuCategoryRequest,
  ) {
    const record = await this.findCategory(scope, id);
    if (!record) throw new Error("Unknown category");
    Object.assign(record, input);
    return record;
  }
  listItems(scope: string, query: MenuItemListQuery, effectiveOnly = false) {
    const all = this.items
      .filter((item) => {
        const category = this.categories.find(
          (candidate) => candidate.id === item.categoryId,
        )!;
        return (
          item.restaurantId === scope &&
          (!query.search ||
            `${item.name} ${item.description ?? ""}`
              .toLowerCase()
              .includes(query.search.toLowerCase())) &&
          (!query.categoryId || item.categoryId === query.categoryId) &&
          (query.status === "all" ||
            item.isActive === (query.status === "active")) &&
          (query.availability === "all" ||
            item.isAvailable === (query.availability === "available")) &&
          (!effectiveOnly ||
            (item.isActive && item.isAvailable && category.isActive))
        );
      })
      .sort((a, b) => a.sortOrder - b.sortOrder);
    const records = all
      .slice((query.page - 1) * query.limit, query.page * query.limit)
      .map((item) => this.hydrate(item));
    return Promise.resolve({ records, total: all.length });
  }
  findItem(scope: string, id: string) {
    const item = this.items.find(
      (candidate) => candidate.restaurantId === scope && candidate.id === id,
    );
    return Promise.resolve(item ? this.hydrate(item) : null);
  }
  createItem(scope: string, input: CreateMenuItemRequest) {
    const record = {
      id: this.id(),
      restaurantId: scope,
      description: null,
      imageUrl: null,
      ...input,
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };
    this.items.push(record);
    return Promise.resolve(this.hydrate(record));
  }
  updateItem(scope: string, id: string, input: UpdateMenuItemRequest) {
    const record = this.items.find(
      (item) => item.restaurantId === scope && item.id === id,
    );
    if (!record) throw new Error("Unknown item");
    Object.assign(record, input);
    return Promise.resolve(this.hydrate(record));
  }
  listModifierGroups(scope: string, includeInactive: boolean) {
    return Promise.resolve(
      this.groups.filter(
        (group) =>
          group.restaurantId === scope && (includeInactive || group.isActive),
      ),
    );
  }
  findModifierGroup(scope: string, id: string) {
    return Promise.resolve(
      this.groups.find(
        (group) => group.restaurantId === scope && group.id === id,
      ) ?? null,
    );
  }
  createModifierGroup(scope: string, input: CreateModifierGroupRequest) {
    const record = {
      id: this.id(),
      restaurantId: scope,
      ...input,
      modifiers: [],
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };
    this.groups.push(record);
    return Promise.resolve(record);
  }
  async updateModifierGroup(
    scope: string,
    id: string,
    input: UpdateModifierGroupRequest,
  ) {
    const record = await this.findModifierGroup(scope, id);
    if (!record) throw new Error("Unknown group");
    Object.assign(record, input);
    return record;
  }
  async createModifier(
    scope: string,
    groupId: string,
    input: CreateModifierRequest,
  ) {
    const group = await this.findModifierGroup(scope, groupId);
    if (!group) throw new Error("Unknown group");
    const modifier = {
      id: this.id(),
      ...input,
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };
    group.modifiers.push(modifier);
    return modifier;
  }
  async updateModifier(
    scope: string,
    groupId: string,
    modifierId: string,
    input: UpdateModifierRequest,
  ) {
    const group = await this.findModifierGroup(scope, groupId);
    const modifier = group?.modifiers.find((item) => item.id === modifierId);
    if (!modifier) return null;
    Object.assign(modifier, input);
    return modifier;
  }
  async assignModifierGroups(
    scope: string,
    itemId: string,
    input: AssignModifierGroupsRequest,
  ) {
    this.assignments = this.assignments.filter(
      (item) => !(item.restaurantId === scope && item.itemId === itemId),
    );
    this.assignments.push(
      ...input.assignments.map((item) => ({
        restaurantId: scope,
        itemId,
        groupId: item.modifierGroupId,
        sortOrder: item.sortOrder,
      })),
    );
    return (await this.findItem(scope, itemId))!;
  }
  private hydrate(
    item: Omit<MenuItemRecord, "category" | "modifierGroups"> & {
      restaurantId: string;
    },
  ): MenuItemRecord {
    return {
      ...item,
      category: this.categories.find(
        (category) => category.id === item.categoryId,
      )!,
      modifierGroups: this.assignments
        .filter(
          (assignment) =>
            assignment.itemId === item.id &&
            assignment.restaurantId === item.restaurantId,
        )
        .map((assignment) => ({
          sortOrder: assignment.sortOrder,
          modifierGroup: this.groups.find(
            (group) => group.id === assignment.groupId,
          )!,
        })),
    };
  }
}

function authService(role: Role, scope = restaurantId): AuthServiceContract {
  const user: AuthenticatedUser = {
    id: "f2bb8ad8-efb4-4d6a-a942-d31a4b432fb2",
    email: "admin@example.com",
    displayName: "Menu Admin",
    memberships: [{ restaurantId: scope, restaurantName: "RestroFlow", role }],
  };
  return {
    login: () => Promise.reject(new Error("Not used")),
    logout: () => Promise.resolve(),
    authenticate: () =>
      Promise.resolve({
        user,
        sessionTokenHash: "hash",
        membershipIds: {
          [scope]: "97a2cbe2-5761-4b1d-8e30-3c4f5b4e766e",
        },
      }),
  };
}

describe("menu management API", () => {
  let repository: MemoryMenuRepository;

  beforeEach(() => {
    repository = new MemoryMenuRepository();
  });

  function app(role: Role = "ADMIN", scope = restaurantId) {
    return createApp({
      allowedOrigins: ["http://localhost:3000"],
      authService: authService(role, scope),
      cookieOptions: { secure: false, maxAgeMs: 60_000 },
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
      menuService: new MenuService(repository),
    });
  }

  async function category(name = "Mains") {
    const response = await request(app())
      .post("/api/v1/menu/categories")
      .send({ name, sortOrder: 0 })
      .expect(201);
    return menuCategoryResponseSchema.parse(response.body).category;
  }
  async function item(categoryId: string, name = "Paneer Bowl") {
    const response = await request(app())
      .post("/api/v1/menu/items")
      .send({ categoryId, name, priceMinor: 12900 })
      .expect(201);
    return menuItemResponseSchema.parse(response.body).item;
  }

  it("creates, updates, deactivates, and rejects duplicate categories", async () => {
    const created = await category();
    await request(app())
      .patch(`/api/v1/menu/categories/${created.id}`)
      .send({ description: "Dinner" })
      .expect(200);
    await request(app())
      .post("/api/v1/menu/categories")
      .send({ name: "Mains" })
      .expect(409);
    const response = await request(app())
      .delete(`/api/v1/menu/categories/${created.id}`)
      .expect(200);
    expect(
      menuCategoryResponseSchema.parse(response.body).category.isActive,
    ).toBe(false);
  });

  it("creates, edits, changes availability, and archives menu items", async () => {
    const group = await category();
    const created = await item(group.id);
    await request(app())
      .patch(`/api/v1/menu/items/${created.id}`)
      .send({ name: "Paneer Rice Bowl" })
      .expect(200);
    const availability = await request(app())
      .patch(`/api/v1/menu/items/${created.id}/availability`)
      .send({ isAvailable: false })
      .expect(200);
    expect(
      menuItemResponseSchema.parse(availability.body).item
        .isEffectivelyAvailable,
    ).toBe(false);
    const archived = await request(app())
      .delete(`/api/v1/menu/items/${created.id}`)
      .expect(200);
    expect(menuItemResponseSchema.parse(archived.body).item).toMatchObject({
      isActive: false,
      isAvailable: false,
    });
  });

  it("validates prices and identifiers", async () => {
    const group = await category();
    await request(app())
      .post("/api/v1/menu/items")
      .send({ categoryId: group.id, name: "Invalid", priceMinor: -1 })
      .expect(400);
    await request(app()).get("/api/v1/menu/items/not-a-uuid").expect(400);
  });

  it("searches, filters, and paginates deterministically", async () => {
    const mains = await category("Mains");
    const drinks = await category("Drinks");
    await item(mains.id, "Paneer Bowl");
    const tea = await item(drinks.id, "Masala Tea");
    await request(app())
      .patch(`/api/v1/menu/items/${tea.id}/availability`)
      .send({ isAvailable: false })
      .expect(200);
    const response = await request(app())
      .get("/api/v1/menu/items")
      .query({
        search: "tea",
        categoryId: drinks.id,
        availability: "unavailable",
        page: 1,
        limit: 1,
      })
      .expect(200);
    const listing = menuItemListResponseSchema.parse(response.body);
    expect(listing.pagination).toMatchObject({ total: 1, totalPages: 1 });
    expect(listing.items[0]?.name).toBe("Masala Tea");
  });

  it("manages modifier groups, options, selection rules, and assignments", async () => {
    const categoryRecord = await category();
    const menuItem = await item(categoryRecord.id);
    const groupResponse = await request(app())
      .post("/api/v1/menu/modifier-groups")
      .send({ name: "Spice", minSelections: 1, maxSelections: 1 })
      .expect(201);
    const groupId = modifierGroupResponseSchema.parse(groupResponse.body).group
      .id;
    await request(app())
      .post(`/api/v1/menu/modifier-groups/${groupId}/modifiers`)
      .send({ name: "Hot", priceDeltaMinor: 0 })
      .expect(201);
    await request(app())
      .patch(`/api/v1/menu/modifier-groups/${groupId}`)
      .send({ minSelections: 2 })
      .expect(400);
    const assigned = await request(app())
      .put(`/api/v1/menu/items/${menuItem.id}/modifier-groups`)
      .send({ assignments: [{ modifierGroupId: groupId, sortOrder: 0 }] })
      .expect(200);
    expect(
      menuItemResponseSchema.parse(assigned.body).item.modifierGroups[0]?.group
        .isRequired,
    ).toBe(true);
  });

  it("rejects cross-restaurant category and modifier references", async () => {
    const foreignCategory = await repository.createCategory(otherRestaurantId, {
      name: "Foreign",
      sortOrder: 0,
      isActive: true,
    });
    await request(app())
      .post("/api/v1/menu/items")
      .send({
        categoryId: foreignCategory.id,
        name: "Cross scope",
        priceMinor: 100,
      })
      .expect(404);
    const localCategory = await category();
    const localItem = await item(localCategory.id);
    const foreignGroup = await repository.createModifierGroup(
      otherRestaurantId,
      {
        name: "Foreign group",
        minSelections: 0,
        maxSelections: 1,
        isActive: true,
      },
    );
    await request(app())
      .put(`/api/v1/menu/items/${localItem.id}/modifier-groups`)
      .send({
        assignments: [{ modifierGroupId: foreignGroup.id, sortOrder: 0 }],
      })
      .expect(404);
  });

  it("keeps managers read-only and blocks cross-restaurant session scope", async () => {
    await request(app("MANAGER"))
      .post("/api/v1/menu/categories")
      .send({ name: "Blocked" })
      .expect(403);
    await request(app("ADMIN", otherRestaurantId))
      .get("/api/v1/menu/categories")
      .set("x-restaurant-id", restaurantId)
      .expect(403);
  });

  it("only exposes effectively available items to operational roles", async () => {
    const categoryRecord = await category();
    await item(categoryRecord.id);
    await request(app())
      .delete(`/api/v1/menu/categories/${categoryRecord.id}`)
      .expect(200);
    const waiter = await request(app("WAITER"))
      .get("/api/v1/menu/items")
      .expect(200);
    expect(menuItemListResponseSchema.parse(waiter.body).items).toHaveLength(0);
  });
});
