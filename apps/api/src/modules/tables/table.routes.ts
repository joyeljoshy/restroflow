import {
  tableListQuerySchema,
  tableSessionListQuerySchema,
  createTableRequestSchema,
  tableParamsSchema,
  updateTableRequestSchema,
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
import type { TableController } from "./table.controller.js";

export function createTableRouter(
  controller: TableController,
  authService: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
): Router {
  const router = Router();
  router.use(requireAuth(authService, cookieOptions), resolveSessionRestaurant);

  router.get(
    "/tables",
    requireRole("ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"),
    validateRequest({ query: tableListQuerySchema }),
    controller.listTables,
  );
  router.get(
    "/tables/:id",
    requireRole("ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"),
    validateRequest({ params: tableParamsSchema }),
    controller.getTable,
  );
  router.post(
    "/tables",
    requireRole("ADMIN"),
    validateRequest({ body: createTableRequestSchema }),
    controller.createTable,
  );
  router.patch(
    "/tables/:id",
    requireRole("ADMIN", "MANAGER"),
    validateRequest({
      params: tableParamsSchema,
      body: updateTableRequestSchema,
    }),
    controller.updateTable,
  );
  router.delete(
    "/tables/:id",
    requireRole("ADMIN"),
    validateRequest({ params: tableParamsSchema }),
    controller.deactivateTable,
  );
  router.post(
    "/tables/:id/sessions",
    requireRole("ADMIN", "MANAGER", "WAITER"),
    validateRequest({ params: tableParamsSchema }),
    controller.openSession,
  );
  router.get(
    "/tables/:id/sessions",
    requireRole("ADMIN", "MANAGER", "WAITER"),
    validateRequest({
      params: tableParamsSchema,
      query: tableSessionListQuerySchema,
    }),
    controller.listSessions,
  );
  router.get(
    "/table-sessions/:id",
    requireRole("ADMIN", "MANAGER", "WAITER", "CASHIER"),
    validateRequest({ params: tableParamsSchema }),
    controller.getSession,
  );
  router.post(
    "/table-sessions/:id/close",
    requireRole("ADMIN", "MANAGER", "WAITER", "CASHIER"),
    validateRequest({ params: tableParamsSchema }),
    controller.closeSession,
  );
  router.get(
    "/tables/:id/qr",
    requireRole("ADMIN"),
    validateRequest({ params: tableParamsSchema }),
    controller.getQrCode,
  );
  router.post(
    "/tables/:id/qr/rotate",
    requireRole("ADMIN"),
    validateRequest({ params: tableParamsSchema }),
    controller.rotateQrCode,
  );

  return router;
}
