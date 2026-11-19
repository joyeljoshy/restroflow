import {
  billListQuerySchema,
  billParamsSchema,
  createPaymentRequestSchema,
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
import type { BillingController } from "./billing.controller.js";

export function createBillingRouter(
  controller: BillingController,
  authService: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
): Router {
  const router = Router();
  router.use(requireAuth(authService, cookieOptions), resolveSessionRestaurant);

  router.get(
    "/billing/active-sessions",
    requireRole("ADMIN", "MANAGER", "CASHIER", "WAITER"),
    controller.listActiveSessions,
  );
  router.get(
    "/table-sessions/:id/bill-preview",
    requireRole("ADMIN", "MANAGER", "CASHIER", "WAITER"),
    validateRequest({ params: billParamsSchema }),
    controller.preview,
  );
  router.post(
    "/table-sessions/:id/bills",
    requireRole("ADMIN", "MANAGER", "CASHIER"),
    validateRequest({ params: billParamsSchema }),
    controller.finalize,
  );
  router.get(
    "/table-sessions/:id/bill",
    requireRole("ADMIN", "MANAGER", "CASHIER", "WAITER"),
    validateRequest({ params: billParamsSchema }),
    controller.getBillBySession,
  );
  router.get(
    "/bills",
    requireRole("ADMIN", "MANAGER", "CASHIER"),
    validateRequest({ query: billListQuerySchema }),
    controller.listBills,
  );
  router.get(
    "/bills/:id",
    requireRole("ADMIN", "MANAGER", "CASHIER"),
    validateRequest({ params: billParamsSchema }),
    controller.getBill,
  );
  router.get(
    "/bills/:id/receipt",
    requireRole("ADMIN", "MANAGER", "CASHIER"),
    validateRequest({ params: billParamsSchema }),
    controller.getReceipt,
  );
  router.get(
    "/bills/:id/payments",
    requireRole("ADMIN", "MANAGER", "CASHIER"),
    validateRequest({ params: billParamsSchema }),
    controller.listPayments,
  );
  router.post(
    "/bills/:id/payments",
    requireRole("ADMIN", "MANAGER", "CASHIER"),
    validateRequest({
      params: billParamsSchema,
      body: createPaymentRequestSchema,
    }),
    controller.recordPayment,
  );

  return router;
}
