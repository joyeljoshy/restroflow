import {
  assignModifierGroupsRequestSchema,
  createMenuCategoryRequestSchema,
  createMenuItemRequestSchema,
  createModifierGroupRequestSchema,
  createModifierRequestSchema,
  menuCategoryListQuerySchema,
  menuEntityParamsSchema,
  menuItemListQuerySchema,
  modifierGroupListQuerySchema,
  modifierGroupParamsSchema,
  modifierParamsSchema,
  updateMenuCategoryRequestSchema,
  updateMenuItemAvailabilityRequestSchema,
  updateMenuItemRequestSchema,
  updateModifierGroupRequestSchema,
  updateModifierRequestSchema,
} from "@restroflow/contracts";
import { raw, Router } from "express";

import { validateRequest } from "../../middleware/validate-request.js";
import {
  requireAuth,
  requireRole,
  resolveSessionRestaurant,
} from "../auth/auth.middleware.js";
import type { SessionCookieOptions } from "../auth/auth.cookies.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import type { MenuController } from "./menu.controller.js";

export function createMenuRouter(
  controller: MenuController,
  authService: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
): Router {
  const router = Router();
  router.use(requireAuth(authService, cookieOptions), resolveSessionRestaurant);

  router.get(
    "/categories",
    validateRequest({ query: menuCategoryListQuerySchema }),
    controller.listCategories,
  );
  router.post(
    "/categories",
    requireRole("ADMIN"),
    validateRequest({ body: createMenuCategoryRequestSchema }),
    controller.createCategory,
  );
  router.patch(
    "/categories/:id",
    requireRole("ADMIN"),
    validateRequest({
      params: menuEntityParamsSchema,
      body: updateMenuCategoryRequestSchema,
    }),
    controller.updateCategory,
  );
  router.delete(
    "/categories/:id",
    requireRole("ADMIN"),
    validateRequest({ params: menuEntityParamsSchema }),
    controller.deactivateCategory,
  );

  router.get(
    "/items",
    validateRequest({ query: menuItemListQuerySchema }),
    controller.listItems,
  );
  router.get(
    "/items/:id",
    validateRequest({ params: menuEntityParamsSchema }),
    controller.getItem,
  );
  router.post(
    "/items",
    requireRole("ADMIN"),
    validateRequest({ body: createMenuItemRequestSchema }),
    controller.createItem,
  );
  router.patch(
    "/items/:id",
    requireRole("ADMIN"),
    validateRequest({
      params: menuEntityParamsSchema,
      body: updateMenuItemRequestSchema,
    }),
    controller.updateItem,
  );
  router.patch(
    "/items/:id/availability",
    requireRole("ADMIN"),
    validateRequest({
      params: menuEntityParamsSchema,
      body: updateMenuItemAvailabilityRequestSchema,
    }),
    controller.updateAvailability,
  );
  router.put(
    "/items/:id/modifier-groups",
    requireRole("ADMIN"),
    validateRequest({
      params: menuEntityParamsSchema,
      body: assignModifierGroupsRequestSchema,
    }),
    controller.assignModifierGroups,
  );
  router.delete(
    "/items/:id",
    requireRole("ADMIN"),
    validateRequest({ params: menuEntityParamsSchema }),
    controller.deactivateItem,
  );

  router.get(
    "/modifier-groups",
    validateRequest({ query: modifierGroupListQuerySchema }),
    controller.listModifierGroups,
  );
  router.post(
    "/modifier-groups",
    requireRole("ADMIN"),
    validateRequest({ body: createModifierGroupRequestSchema }),
    controller.createModifierGroup,
  );
  router.patch(
    "/modifier-groups/:id",
    requireRole("ADMIN"),
    validateRequest({
      params: menuEntityParamsSchema,
      body: updateModifierGroupRequestSchema,
    }),
    controller.updateModifierGroup,
  );
  router.delete(
    "/modifier-groups/:id",
    requireRole("ADMIN"),
    validateRequest({ params: menuEntityParamsSchema }),
    controller.deactivateModifierGroup,
  );
  router.post(
    "/modifier-groups/:groupId/modifiers",
    requireRole("ADMIN"),
    validateRequest({
      params: modifierGroupParamsSchema,
      body: createModifierRequestSchema,
    }),
    controller.createModifier,
  );
  router.patch(
    "/modifier-groups/:groupId/modifiers/:modifierId",
    requireRole("ADMIN"),
    validateRequest({
      params: modifierParamsSchema,
      body: updateModifierRequestSchema,
    }),
    controller.updateModifier,
  );
  router.delete(
    "/modifier-groups/:groupId/modifiers/:modifierId",
    requireRole("ADMIN"),
    validateRequest({ params: modifierParamsSchema }),
    controller.deactivateModifier,
  );

  router.post(
    "/images",
    requireRole("ADMIN"),
    raw({ type: ["image/jpeg", "image/png", "image/webp"], limit: "3mb" }),
    controller.uploadImage,
  );
  return router;
}
