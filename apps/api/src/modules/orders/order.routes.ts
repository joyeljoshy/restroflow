import {
  addOrderItemsRequestSchema,
  createOrderRequestSchema,
  kitchenTicketListQuerySchema,
  orderListQuerySchema,
  orderParamsSchema,
  updateOrderStatusRequestSchema,
  updateOrderItemStatusRequestSchema,
} from "@restroflow/contracts";
import { Router } from "express";

import { validateRequest } from "../../middleware/validate-request.js";
import {
  requireAuth,
  requireRole,
  resolveSessionRestaurant,
} from "../auth/auth.middleware.js";
import type { SessionCookieOptions } from "../auth/auth.cookies.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import type { OrderController } from "./order.controller.js";

export function createOrderRouter(
  controller: OrderController,
  authService: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
): Router {
  const router = Router();
  router.use(requireAuth(authService, cookieOptions), resolveSessionRestaurant);

  router.post(
    "/orders",
    requireRole("ADMIN", "MANAGER", "WAITER"),
    validateRequest({ body: createOrderRequestSchema }),
    controller.createOrder,
  );
  router.get(
    "/orders",
    requireRole("ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"),
    validateRequest({ query: orderListQuerySchema }),
    controller.listOrders,
  );
  router.get(
    "/orders/:id",
    requireRole("ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"),
    validateRequest({ params: orderParamsSchema }),
    controller.getOrder,
  );
  router.post(
    "/orders/:id/items",
    requireRole("ADMIN", "MANAGER", "WAITER"),
    validateRequest({
      params: orderParamsSchema,
      body: addOrderItemsRequestSchema,
    }),
    controller.addItems,
  );
  router.patch(
    "/orders/:id/status",
    requireRole("ADMIN", "MANAGER", "WAITER", "KITCHEN"),
    validateRequest({
      params: orderParamsSchema,
      body: updateOrderStatusRequestSchema,
    }),
    controller.updateStatus,
  );
  router.get(
    "/kitchen/tickets",
    requireRole("ADMIN", "MANAGER", "KITCHEN"),
    validateRequest({ query: kitchenTicketListQuerySchema }),
    controller.listKitchenTickets,
  );
  router.get(
    "/kitchen/tickets/:id",
    requireRole("ADMIN", "MANAGER", "KITCHEN"),
    validateRequest({ params: orderParamsSchema }),
    controller.getOrder,
  );
  router.patch(
    "/kitchen/orders/:id/status",
    requireRole("ADMIN", "MANAGER", "KITCHEN"),
    validateRequest({
      params: orderParamsSchema,
      body: updateOrderStatusRequestSchema,
    }),
    controller.updateStatus,
  );
  router.patch(
    "/kitchen/items/:id/status",
    requireRole("ADMIN", "MANAGER", "KITCHEN"),
    validateRequest({
      params: orderParamsSchema,
      body: updateOrderItemStatusRequestSchema,
    }),
    controller.updateItemStatus,
  );
  router.get(
    "/orders/:id/history",
    requireRole("ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"),
    validateRequest({ params: orderParamsSchema }),
    controller.listHistory,
  );

  return router;
}
