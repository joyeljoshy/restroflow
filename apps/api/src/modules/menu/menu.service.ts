import type {
  AssignModifierGroupsRequest,
  CreateMenuCategoryRequest,
  CreateMenuItemRequest,
  CreateModifierGroupRequest,
  CreateModifierRequest,
  MenuCategory,
  MenuItem,
  MenuItemListQuery,
  MenuItemListResponse,
  Modifier,
  ModifierGroup,
  UpdateMenuCategoryRequest,
  UpdateMenuItemRequest,
  UpdateModifierGroupRequest,
  UpdateModifierRequest,
} from "@restroflow/contracts";

import { AppError } from "../../errors/app-error.js";
import type {
  CategoryRecord,
  MenuItemRecord,
  MenuRepository,
  ModifierGroupRecord,
  ModifierRecord,
} from "./menu.repository.js";

export interface MenuServiceContract {
  listCategories(
    restaurantId: string,
    includeInactive: boolean,
  ): Promise<MenuCategory[]>;
  createCategory(
    restaurantId: string,
    input: CreateMenuCategoryRequest,
  ): Promise<MenuCategory>;
  updateCategory(
    restaurantId: string,
    id: string,
    input: UpdateMenuCategoryRequest,
  ): Promise<MenuCategory>;
  deactivateCategory(restaurantId: string, id: string): Promise<MenuCategory>;
  listItems(
    restaurantId: string,
    query: MenuItemListQuery,
    effectiveOnly?: boolean,
  ): Promise<MenuItemListResponse>;
  getItem(restaurantId: string, id: string): Promise<MenuItem>;
  createItem(
    restaurantId: string,
    input: CreateMenuItemRequest,
  ): Promise<MenuItem>;
  updateItem(
    restaurantId: string,
    id: string,
    input: UpdateMenuItemRequest,
  ): Promise<MenuItem>;
  deactivateItem(restaurantId: string, id: string): Promise<MenuItem>;
  listModifierGroups(
    restaurantId: string,
    includeInactive: boolean,
  ): Promise<ModifierGroup[]>;
  createModifierGroup(
    restaurantId: string,
    input: CreateModifierGroupRequest,
  ): Promise<ModifierGroup>;
  updateModifierGroup(
    restaurantId: string,
    id: string,
    input: UpdateModifierGroupRequest,
  ): Promise<ModifierGroup>;
  deactivateModifierGroup(
    restaurantId: string,
    id: string,
  ): Promise<ModifierGroup>;
  createModifier(
    restaurantId: string,
    groupId: string,
    input: CreateModifierRequest,
  ): Promise<Modifier>;
  updateModifier(
    restaurantId: string,
    groupId: string,
    modifierId: string,
    input: UpdateModifierRequest,
  ): Promise<Modifier>;
  deactivateModifier(
    restaurantId: string,
    groupId: string,
    modifierId: string,
  ): Promise<Modifier>;
  assignModifierGroups(
    restaurantId: string,
    itemId: string,
    input: AssignModifierGroupsRequest,
  ): Promise<MenuItem>;
}

function toCategory(record: CategoryRecord): MenuCategory {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
function toModifier(record: ModifierRecord): Modifier {
  return {
    ...record,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
function toModifierGroup(record: ModifierGroupRecord): ModifierGroup {
  return {
    ...record,
    isRequired: record.minSelections > 0,
    modifiers: record.modifiers.map(toModifier),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
function toItem(record: MenuItemRecord): MenuItem {
  return {
    ...record,
    category: toCategory(record.category),
    isEffectivelyAvailable:
      record.isActive && record.isAvailable && record.category.isActive,
    modifierGroups: record.modifierGroups.map(
      ({ sortOrder, modifierGroup }) => ({
        sortOrder,
        group: toModifierGroup(modifierGroup),
      }),
    ),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}
function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

export class MenuService implements MenuServiceContract {
  constructor(private readonly repository: MenuRepository) {}

  async listCategories(restaurantId: string, includeInactive: boolean) {
    return (
      await this.repository.listCategories(restaurantId, includeInactive)
    ).map(toCategory);
  }

  async createCategory(restaurantId: string, input: CreateMenuCategoryRequest) {
    try {
      return toCategory(
        await this.repository.createCategory(restaurantId, input),
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new AppError(
          409,
          "CATEGORY_NAME_CONFLICT",
          "A category with that name already exists.",
        );
      throw error;
    }
  }

  async updateCategory(
    restaurantId: string,
    id: string,
    input: UpdateMenuCategoryRequest,
  ) {
    await this.requireCategory(restaurantId, id);
    try {
      return toCategory(
        await this.repository.updateCategory(restaurantId, id, input),
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new AppError(
          409,
          "CATEGORY_NAME_CONFLICT",
          "A category with that name already exists.",
        );
      throw error;
    }
  }

  deactivateCategory(restaurantId: string, id: string) {
    return this.updateCategory(restaurantId, id, { isActive: false });
  }

  async listItems(
    restaurantId: string,
    query: MenuItemListQuery,
    effectiveOnly = false,
  ): Promise<MenuItemListResponse> {
    if (query.categoryId)
      await this.requireCategory(restaurantId, query.categoryId);
    const { records, total } = await this.repository.listItems(
      restaurantId,
      query,
      effectiveOnly,
    );
    return {
      items: records.map(toItem),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: Math.ceil(total / query.limit),
      },
    };
  }

  async getItem(restaurantId: string, id: string) {
    const item = await this.repository.findItem(restaurantId, id);
    if (!item)
      throw new AppError(404, "MENU_ITEM_NOT_FOUND", "Menu item not found.");
    return toItem(item);
  }

  async createItem(restaurantId: string, input: CreateMenuItemRequest) {
    await this.requireActiveCategory(restaurantId, input.categoryId);
    return toItem(await this.repository.createItem(restaurantId, input));
  }

  async updateItem(
    restaurantId: string,
    id: string,
    input: UpdateMenuItemRequest,
  ) {
    await this.getItem(restaurantId, id);
    if (input.categoryId)
      await this.requireActiveCategory(restaurantId, input.categoryId);
    return toItem(await this.repository.updateItem(restaurantId, id, input));
  }

  deactivateItem(restaurantId: string, id: string) {
    return this.updateItem(restaurantId, id, {
      isActive: false,
      isAvailable: false,
    });
  }

  async listModifierGroups(restaurantId: string, includeInactive: boolean) {
    return (
      await this.repository.listModifierGroups(restaurantId, includeInactive)
    ).map(toModifierGroup);
  }

  async createModifierGroup(
    restaurantId: string,
    input: CreateModifierGroupRequest,
  ) {
    try {
      return toModifierGroup(
        await this.repository.createModifierGroup(restaurantId, input),
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new AppError(
          409,
          "MODIFIER_GROUP_NAME_CONFLICT",
          "A modifier group with that name already exists.",
        );
      throw error;
    }
  }

  async updateModifierGroup(
    restaurantId: string,
    id: string,
    input: UpdateModifierGroupRequest,
  ) {
    const current = await this.requireModifierGroup(restaurantId, id);
    const minimum = input.minSelections ?? current.minSelections;
    const maximum = input.maxSelections ?? current.maxSelections;
    if (minimum > maximum)
      throw new AppError(
        400,
        "INVALID_SELECTION_LIMITS",
        "Minimum selections cannot exceed maximum selections.",
      );
    try {
      return toModifierGroup(
        await this.repository.updateModifierGroup(restaurantId, id, input),
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new AppError(
          409,
          "MODIFIER_GROUP_NAME_CONFLICT",
          "A modifier group with that name already exists.",
        );
      throw error;
    }
  }

  deactivateModifierGroup(restaurantId: string, id: string) {
    return this.updateModifierGroup(restaurantId, id, { isActive: false });
  }

  async createModifier(
    restaurantId: string,
    groupId: string,
    input: CreateModifierRequest,
  ) {
    const group = await this.requireModifierGroup(restaurantId, groupId);
    if (!group.isActive)
      throw new AppError(
        409,
        "MODIFIER_GROUP_INACTIVE",
        "Activate the modifier group before adding options.",
      );
    try {
      return toModifier(
        await this.repository.createModifier(restaurantId, groupId, input),
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new AppError(
          409,
          "MODIFIER_NAME_CONFLICT",
          "That modifier already exists in this group.",
        );
      throw error;
    }
  }

  async updateModifier(
    restaurantId: string,
    groupId: string,
    modifierId: string,
    input: UpdateModifierRequest,
  ) {
    await this.requireModifierGroup(restaurantId, groupId);
    const modifier = await this.repository.updateModifier(
      restaurantId,
      groupId,
      modifierId,
      input,
    );
    if (!modifier)
      throw new AppError(404, "MODIFIER_NOT_FOUND", "Modifier not found.");
    return toModifier(modifier);
  }

  deactivateModifier(
    restaurantId: string,
    groupId: string,
    modifierId: string,
  ) {
    return this.updateModifier(restaurantId, groupId, modifierId, {
      isAvailable: false,
    });
  }

  async assignModifierGroups(
    restaurantId: string,
    itemId: string,
    input: AssignModifierGroupsRequest,
  ) {
    await this.getItem(restaurantId, itemId);
    for (const assignment of input.assignments) {
      const group = await this.requireModifierGroup(
        restaurantId,
        assignment.modifierGroupId,
      );
      if (!group.isActive)
        throw new AppError(
          409,
          "MODIFIER_GROUP_INACTIVE",
          "Inactive modifier groups cannot be assigned.",
        );
    }
    return toItem(
      await this.repository.assignModifierGroups(restaurantId, itemId, input),
    );
  }

  private async requireCategory(restaurantId: string, id: string) {
    const category = await this.repository.findCategory(restaurantId, id);
    if (!category)
      throw new AppError(
        404,
        "MENU_CATEGORY_NOT_FOUND",
        "Menu category not found.",
      );
    return category;
  }

  private async requireActiveCategory(restaurantId: string, id: string) {
    const category = await this.requireCategory(restaurantId, id);
    if (!category.isActive)
      throw new AppError(
        409,
        "MENU_CATEGORY_INACTIVE",
        "Menu items can only be placed in an active category.",
      );
    return category;
  }

  private async requireModifierGroup(restaurantId: string, id: string) {
    const group = await this.repository.findModifierGroup(restaurantId, id);
    if (!group)
      throw new AppError(
        404,
        "MODIFIER_GROUP_NOT_FOUND",
        "Modifier group not found.",
      );
    return group;
  }
}
