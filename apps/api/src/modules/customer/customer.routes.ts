import {
  activateCustomerSessionRequestSchema,
  customerCreateOrderRequestSchema,
  issueActivationParamsSchema,
  orderParamsSchema,
  publicTableIdentifierParamsSchema,
} from "@restroflow/contracts";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { validateRequest } from "../../middleware/validate-request.js";
import {
  requireAuth,
  requireRole,
  resolveSessionRestaurant,
} from "../auth/auth.middleware.js";
import type { SessionCookieOptions } from "../auth/auth.cookies.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import type { CustomerController } from "./customer.controller.js";
import {
  requireCustomerSession,
  requireTrustedOrigin,
} from "./customer.middleware.js";
import type { CustomerServiceContract } from "./customer.service.js";

export function createCustomerRouter(
  controller: CustomerController,
  service: CustomerServiceContract,
  authService: AuthServiceContract,
  staffCookieOptions: SessionCookieOptions,
  customerCookieOptions: SessionCookieOptions,
  allowedOrigins: string[],
) {
  const router = Router();
  const commandOrigin = requireTrustedOrigin(allowedOrigins);
  const activationLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const orderLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
  });

  router.get(
    "/public/tables/:identifier",
    validateRequest({ params: publicTableIdentifierParamsSchema }),
    controller.getTable,
  );
  router.get(
    "/public/tables/:identifier/menu",
    validateRequest({ params: publicTableIdentifierParamsSchema }),
    controller.getMenu,
  );
  router.post(
    "/public/table-access/activate",
    commandOrigin,
    activationLimiter,
    validateRequest({ body: activateCustomerSessionRequestSchema }),
    controller.activate,
  );

  const customerAuth = requireCustomerSession(service, customerCookieOptions);
  router.get("/public/customer-session", customerAuth, controller.getSession);
  router.post(
    "/public/customer-session/logout",
    commandOrigin,
    controller.logout,
  );
  router.post(
    "/public/orders",
    commandOrigin,
    orderLimiter,
    customerAuth,
    validateRequest({ body: customerCreateOrderRequestSchema }),
    controller.createOrder,
  );
  router.get("/public/orders", customerAuth, controller.listOrders);
  router.get(
    "/public/orders/:id",
    customerAuth,
    validateRequest({ params: orderParamsSchema }),
    controller.getOrder,
  );

  router.post(
    "/table-sessions/:id/customer-access",
    requireAuth(authService, staffCookieOptions),
    resolveSessionRestaurant,
    requireRole("ADMIN", "MANAGER", "WAITER"),
    validateRequest({ params: issueActivationParamsSchema }),
    controller.issueActivation,
  );

  return router;
}
