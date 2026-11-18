import type {
  AssignModifierGroupsRequest,
  CreateMenuCategoryRequest,
  CreateMenuItemRequest,
  CreateModifierGroupRequest,
  CreateModifierRequest,
  MenuItemListQuery,
  UpdateMenuCategoryRequest,
  UpdateMenuItemRequest,
  UpdateModifierGroupRequest,
  UpdateModifierRequest,
} from "@restroflow/contracts";

import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export type CategoryRecord = {
  id: string;
  name: string;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ModifierRecord = {
  id: string;
  name: string;
  priceDeltaMinor: number;
  isAvailable: boolean;
  createdAt: Date;
  updatedAt: Date;
};

export type ModifierGroupRecord = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isActive: boolean;
  modifiers: ModifierRecord[];
  createdAt: Date;
  updatedAt: Date;
};

export type MenuItemRecord = {
  id: string;
  categoryId: string;
  name: string;
  description: string | null;
  priceMinor: number;
  imageUrl: string | null;
  isAvailable: boolean;
  isVegetarian: boolean;
  isActive: boolean;
  sortOrder: number;
  category: CategoryRecord;
  modifierGroups: { sortOrder: number; modifierGroup: ModifierGroupRecord }[];
  createdAt: Date;
  updatedAt: Date;
};

export interface MenuRepository {
  listCategories(
    restaurantId: string,
    includeInactive: boolean,
  ): Promise<CategoryRecord[]>;
  findCategory(
    restaurantId: string,
    id: string,
  ): Promise<CategoryRecord | null>;
  createCategory(
    restaurantId: string,
    input: CreateMenuCategoryRequest,
  ): Promise<CategoryRecord>;
  updateCategory(
    restaurantId: string,
    id: string,
    input: UpdateMenuCategoryRequest,
  ): Promise<CategoryRecord>;
  listItems(
    restaurantId: string,
    query: MenuItemListQuery,
    effectiveOnly?: boolean,
  ): Promise<{ records: MenuItemRecord[]; total: number }>;
  findItem(restaurantId: string, id: string): Promise<MenuItemRecord | null>;
  createItem(
    restaurantId: string,
    input: CreateMenuItemRequest,
  ): Promise<MenuItemRecord>;
  updateItem(
    restaurantId: string,
    id: string,
    input: UpdateMenuItemRequest,
  ): Promise<MenuItemRecord>;
  listModifierGroups(
    restaurantId: string,
    includeInactive: boolean,
  ): Promise<ModifierGroupRecord[]>;
  findModifierGroup(
    restaurantId: string,
    id: string,
  ): Promise<ModifierGroupRecord | null>;
  createModifierGroup(
    restaurantId: string,
    input: CreateModifierGroupRequest,
  ): Promise<ModifierGroupRecord>;
  updateModifierGroup(
    restaurantId: string,
    id: string,
    input: UpdateModifierGroupRequest,
  ): Promise<ModifierGroupRecord>;
  createModifier(
    restaurantId: string,
    groupId: string,
    input: CreateModifierRequest,
  ): Promise<ModifierRecord>;
  updateModifier(
    restaurantId: string,
    groupId: string,
    modifierId: string,
    input: UpdateModifierRequest,
  ): Promise<ModifierRecord | null>;
  assignModifierGroups(
    restaurantId: string,
    itemId: string,
    input: AssignModifierGroupsRequest,
  ): Promise<MenuItemRecord>;
}

const categorySelection = {
  id: true,
  name: true,
  description: true,
  sortOrder: true,
  isActive: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MenuCategorySelect;
const modifierSelection = {
  id: true,
  name: true,
  priceDeltaMinor: true,
  isAvailable: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ModifierSelect;
const modifierGroupSelection = {
  id: true,
  name: true,
  minSelections: true,
  maxSelections: true,
  isActive: true,
  modifiers: {
    select: modifierSelection,
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ModifierGroupSelect;
const itemSelection = {
  id: true,
  categoryId: true,
  name: true,
  description: true,
  priceMinor: true,
  imageUrl: true,
  isAvailable: true,
  isVegetarian: true,
  isActive: true,
  sortOrder: true,
  category: { select: categorySelection },
  modifierGroups: {
    select: {
      sortOrder: true,
      modifierGroup: { select: modifierGroupSelection },
    },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MenuItemSelect;

export class PrismaMenuRepository implements MenuRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listCategories(
    restaurantId: string,
    includeInactive: boolean,
  ): Promise<CategoryRecord[]> {
    return this.prisma.menuCategory.findMany({
      where: { restaurantId, ...(includeInactive ? {} : { isActive: true }) },
      select: categorySelection,
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
    });
  }

  findCategory(
    restaurantId: string,
    id: string,
  ): Promise<CategoryRecord | null> {
    return this.prisma.menuCategory.findFirst({
      where: { id, restaurantId },
      select: categorySelection,
    });
  }

  createCategory(
    restaurantId: string,
    input: CreateMenuCategoryRequest,
  ): Promise<CategoryRecord> {
    return this.prisma.menuCategory.create({
      data: { restaurantId, ...input },
      select: categorySelection,
    });
  }

  updateCategory(
    restaurantId: string,
    id: string,
    input: UpdateMenuCategoryRequest,
  ): Promise<CategoryRecord> {
    return this.prisma.menuCategory.update({
      where: { id_restaurantId: { id, restaurantId } },
      data: input,
      select: categorySelection,
    });
  }

  async listItems(
    restaurantId: string,
    query: MenuItemListQuery,
    effectiveOnly = false,
  ) {
    const where = {
      restaurantId,
      ...(query.search
        ? {
            OR: [
              {
                name: { contains: query.search, mode: "insensitive" as const },
              },
              {
                description: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
            ],
          }
        : {}),
      ...(query.categoryId ? { categoryId: query.categoryId } : {}),
      ...(query.availability === "all"
        ? {}
        : { isAvailable: query.availability === "available" }),
      ...(query.status === "all"
        ? {}
        : { isActive: query.status === "active" }),
      ...(effectiveOnly
        ? { isActive: true, isAvailable: true, category: { isActive: true } }
        : {}),
    };
    const [records, total] = await this.prisma.$transaction([
      this.prisma.menuItem.findMany({
        where,
        select: itemSelection,
        orderBy: [
          { category: { sortOrder: "asc" } },
          { sortOrder: "asc" },
          { name: "asc" },
          { id: "asc" },
        ],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.menuItem.count({ where }),
    ]);
    return { records, total };
  }

  findItem(restaurantId: string, id: string): Promise<MenuItemRecord | null> {
    return this.prisma.menuItem.findFirst({
      where: { id, restaurantId },
      select: itemSelection,
    });
  }

  createItem(
    restaurantId: string,
    input: CreateMenuItemRequest,
  ): Promise<MenuItemRecord> {
    return this.prisma.menuItem.create({
      data: { restaurantId, ...input },
      select: itemSelection,
    });
  }

  updateItem(
    restaurantId: string,
    id: string,
    input: UpdateMenuItemRequest,
  ): Promise<MenuItemRecord> {
    return this.prisma.menuItem.update({
      where: { id_restaurantId: { id, restaurantId } },
      data: input,
      select: itemSelection,
    });
  }

  listModifierGroups(
    restaurantId: string,
    includeInactive: boolean,
  ): Promise<ModifierGroupRecord[]> {
    return this.prisma.modifierGroup.findMany({
      where: { restaurantId, ...(includeInactive ? {} : { isActive: true }) },
      select: modifierGroupSelection,
      orderBy: [{ name: "asc" }, { id: "asc" }],
    });
  }

  findModifierGroup(
    restaurantId: string,
    id: string,
  ): Promise<ModifierGroupRecord | null> {
    return this.prisma.modifierGroup.findFirst({
      where: { id, restaurantId },
      select: modifierGroupSelection,
    });
  }

  createModifierGroup(
    restaurantId: string,
    input: CreateModifierGroupRequest,
  ): Promise<ModifierGroupRecord> {
    return this.prisma.modifierGroup.create({
      data: { restaurantId, ...input },
      select: modifierGroupSelection,
    });
  }

  updateModifierGroup(
    restaurantId: string,
    id: string,
    input: UpdateModifierGroupRequest,
  ): Promise<ModifierGroupRecord> {
    return this.prisma.modifierGroup.update({
      where: { id_restaurantId: { id, restaurantId } },
      data: input,
      select: modifierGroupSelection,
    });
  }

  createModifier(
    restaurantId: string,
    groupId: string,
    input: CreateModifierRequest,
  ): Promise<ModifierRecord> {
    return this.prisma.modifier.create({
      data: {
        ...input,
        modifierGroup: {
          connect: { id_restaurantId: { id: groupId, restaurantId } },
        },
      },
      select: modifierSelection,
    });
  }

  async updateModifier(
    restaurantId: string,
    groupId: string,
    modifierId: string,
    input: UpdateModifierRequest,
  ): Promise<ModifierRecord | null> {
    const existing = await this.prisma.modifier.findFirst({
      where: {
        id: modifierId,
        modifierGroupId: groupId,
        modifierGroup: { restaurantId },
      },
      select: { id: true },
    });
    if (!existing) return null;
    return this.prisma.modifier.update({
      where: { id: modifierId },
      data: input,
      select: modifierSelection,
    });
  }

  assignModifierGroups(
    restaurantId: string,
    itemId: string,
    input: AssignModifierGroupsRequest,
  ): Promise<MenuItemRecord> {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.menuItemModifierGroup.deleteMany({
        where: { restaurantId, menuItemId: itemId },
      });
      if (input.assignments.length > 0) {
        await transaction.menuItemModifierGroup.createMany({
          data: input.assignments.map((assignment) => ({
            restaurantId,
            menuItemId: itemId,
            ...assignment,
          })),
        });
      }
      return transaction.menuItem.findUniqueOrThrow({
        where: { id_restaurantId: { id: itemId, restaurantId } },
        select: itemSelection,
      });
    });
  }
}
