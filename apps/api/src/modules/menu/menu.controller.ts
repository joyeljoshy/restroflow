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
import type { RequestHandler } from "express";

import type { MenuServiceContract } from "./menu.service.js";
import type { MenuImageStorage } from "./menu-image.storage.js";

export class MenuController {
  constructor(
    private readonly service: MenuServiceContract,
    private readonly imageStorage?: MenuImageStorage,
  ) {}

  private restaurantId(req: Parameters<RequestHandler>[0]) {
    return req.restaurantAccess!.restaurantId;
  }

  listCategories: RequestHandler = async (req, res) => {
    const canManage = ["ADMIN", "MANAGER"].includes(req.restaurantAccess!.role);
    const categories = await this.service.listCategories(
      this.restaurantId(req),
      canManage && Boolean(req.query.includeInactive),
    );
    res.status(200).json({ categories });
  };

  createCategory: RequestHandler = async (req, res) => {
    const category = await this.service.createCategory(
      this.restaurantId(req),
      req.body as CreateMenuCategoryRequest,
    );
    res.status(201).json({ category });
  };

  updateCategory: RequestHandler = async (req, res) => {
    const category = await this.service.updateCategory(
      this.restaurantId(req),
      req.params.id as string,
      req.body as UpdateMenuCategoryRequest,
    );
    res.status(200).json({ category });
  };

  deactivateCategory: RequestHandler = async (req, res) => {
    const category = await this.service.deactivateCategory(
      this.restaurantId(req),
      req.params.id as string,
    );
    res.status(200).json({ category });
  };

  listItems: RequestHandler = async (req, res) => {
    const managementRead = ["ADMIN", "MANAGER"].includes(
      req.restaurantAccess!.role,
    );
    const result = await this.service.listItems(
      this.restaurantId(req),
      req.query as unknown as MenuItemListQuery,
      !managementRead,
    );
    res.status(200).json(result);
  };

  getItem: RequestHandler = async (req, res) => {
    const item = await this.service.getItem(
      this.restaurantId(req),
      req.params.id as string,
    );
    const managementRead = ["ADMIN", "MANAGER"].includes(
      req.restaurantAccess!.role,
    );
    if (!managementRead && !item.isEffectivelyAvailable) {
      res.status(404).json({
        error: {
          code: "MENU_ITEM_NOT_FOUND",
          message: "Menu item not found.",
          requestId: req.id,
        },
      });
      return;
    }
    res.status(200).json({ item });
  };

  createItem: RequestHandler = async (req, res) => {
    const item = await this.service.createItem(
      this.restaurantId(req),
      req.body as CreateMenuItemRequest,
    );
    res.status(201).json({ item });
  };

  updateItem: RequestHandler = async (req, res) => {
    const item = await this.service.updateItem(
      this.restaurantId(req),
      req.params.id as string,
      req.body as UpdateMenuItemRequest,
    );
    res.status(200).json({ item });
  };

  updateAvailability: RequestHandler = async (req, res) => {
    const input = req.body as { isAvailable: boolean };
    const item = await this.service.updateItem(
      this.restaurantId(req),
      req.params.id as string,
      { isAvailable: input.isAvailable },
    );
    res.status(200).json({ item });
  };

  deactivateItem: RequestHandler = async (req, res) => {
    const item = await this.service.deactivateItem(
      this.restaurantId(req),
      req.params.id as string,
    );
    res.status(200).json({ item });
  };

  listModifierGroups: RequestHandler = async (req, res) => {
    const canManage = ["ADMIN", "MANAGER"].includes(req.restaurantAccess!.role);
    const groups = await this.service.listModifierGroups(
      this.restaurantId(req),
      canManage && Boolean(req.query.includeInactive),
    );
    res.status(200).json({ groups });
  };

  createModifierGroup: RequestHandler = async (req, res) => {
    const group = await this.service.createModifierGroup(
      this.restaurantId(req),
      req.body as CreateModifierGroupRequest,
    );
    res.status(201).json({ group });
  };

  updateModifierGroup: RequestHandler = async (req, res) => {
    const group = await this.service.updateModifierGroup(
      this.restaurantId(req),
      req.params.id as string,
      req.body as UpdateModifierGroupRequest,
    );
    res.status(200).json({ group });
  };

  deactivateModifierGroup: RequestHandler = async (req, res) => {
    const group = await this.service.deactivateModifierGroup(
      this.restaurantId(req),
      req.params.id as string,
    );
    res.status(200).json({ group });
  };

  createModifier: RequestHandler = async (req, res) => {
    const modifier = await this.service.createModifier(
      this.restaurantId(req),
      req.params.groupId as string,
      req.body as CreateModifierRequest,
    );
    res.status(201).json({ modifier });
  };

  updateModifier: RequestHandler = async (req, res) => {
    const modifier = await this.service.updateModifier(
      this.restaurantId(req),
      req.params.groupId as string,
      req.params.modifierId as string,
      req.body as UpdateModifierRequest,
    );
    res.status(200).json({ modifier });
  };

  deactivateModifier: RequestHandler = async (req, res) => {
    const modifier = await this.service.deactivateModifier(
      this.restaurantId(req),
      req.params.groupId as string,
      req.params.modifierId as string,
    );
    res.status(200).json({ modifier });
  };

  assignModifierGroups: RequestHandler = async (req, res) => {
    const item = await this.service.assignModifierGroups(
      this.restaurantId(req),
      req.params.id as string,
      req.body as AssignModifierGroupsRequest,
    );
    res.status(200).json({ item });
  };

  uploadImage: RequestHandler = async (req, res) => {
    if (!this.imageStorage)
      throw new Error("Menu image storage is not configured.");
    const imageUrl = await this.imageStorage.save(
      req.header("content-type"),
      Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0),
    );
    res.status(201).json({ imageUrl });
  };
}
