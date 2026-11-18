import {
  createStaffRequestSchema,
  restaurantIdParamsSchema,
  staffIdParamsSchema,
  staffListQuerySchema,
  updateRestaurantRequestSchema,
  updateStaffRequestSchema,
} from "@restroflow/contracts";
import { Router } from "express";

import { validateRequest } from "../../middleware/validate-request.js";
import {
  requireAuth,
  requireRestaurantAccess,
  requireRole,
} from "../auth/auth.middleware.js";
import type { SessionCookieOptions } from "../auth/auth.cookies.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import type { StaffController } from "../staff/staff.controller.js";
import type { RestaurantController } from "./restaurant.controller.js";

export function createRestaurantRouter(
  restaurantController: RestaurantController,
  staffController: StaffController,
  authService: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
): Router {
  const router = Router();
  const authenticate = requireAuth(authService, cookieOptions);

  router.get(
    "/:restaurantId",
    authenticate,
    validateRequest({ params: restaurantIdParamsSchema }),
    requireRestaurantAccess,
    requireRole("ADMIN", "MANAGER"),
    restaurantController.get,
  );
  router.patch(
    "/:restaurantId",
    authenticate,
    validateRequest({
      params: restaurantIdParamsSchema,
      body: updateRestaurantRequestSchema,
    }),
    requireRestaurantAccess,
    requireRole("ADMIN"),
    restaurantController.update,
  );
  router.get(
    "/:restaurantId/staff",
    authenticate,
    validateRequest({
      params: restaurantIdParamsSchema,
      query: staffListQuerySchema,
    }),
    requireRestaurantAccess,
    requireRole("ADMIN", "MANAGER"),
    staffController.list,
  );
  router.post(
    "/:restaurantId/staff",
    authenticate,
    validateRequest({
      params: restaurantIdParamsSchema,
      body: createStaffRequestSchema,
    }),
    requireRestaurantAccess,
    requireRole("ADMIN"),
    staffController.create,
  );
  router.patch(
    "/:restaurantId/staff/:staffId",
    authenticate,
    validateRequest({
      params: staffIdParamsSchema,
      body: updateStaffRequestSchema,
    }),
    requireRestaurantAccess,
    requireRole("ADMIN"),
    staffController.update,
  );
  return router;
}
