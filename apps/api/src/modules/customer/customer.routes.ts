import { timingSafeEqual } from "node:crypto";
import { isIP } from "node:net";
import type { Request } from "express";
import {
  activateCustomerSessionRequestSchema,
  customerCreateOrderRequestSchema,
  issueActivationParamsSchema,
  orderParamsSchema,
  publicTableIdentifierParamsSchema,
} from "@restroflow/contracts";
import { Router } from "express";
import { ipKeyGenerator, rateLimit } from "express-rate-limit";

import { AppError } from "../../errors/app-error.js";
import { validateRequest } from "../../middleware/validate-request.js";
import { requireTrustedOrigin } from "../../middleware/trusted-origin.js";
import {
  requireAuth,
  requireRole,
  resolveSessionRestaurant,
} from "../auth/auth.middleware.js";
import type { SessionCookieOptions } from "../auth/auth.cookies.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import type { CustomerController } from "./customer.controller.js";
import { requireCustomerSession } from "./customer.middleware.js";
import type { CustomerServiceContract } from "./customer.service.js";

export function createCustomerRouter(
  controller: CustomerController,
  service: CustomerServiceContract,
  authService: AuthServiceContract,
  staffCookieOptions: SessionCookieOptions,
  customerCookieOptions: SessionCookieOptions,
  allowedOrigins: string[],
  proxySecret?: string,
) {
  const router = Router();
  const commandOrigin = requireTrustedOrigin(allowedOrigins);
  const verifiedClientIps = new WeakMap<Request, string>();
  const expected = proxySecret ? Buffer.from(proxySecret) : undefined;
  router.use("/public", (req, _res, next) => {
    const claimedIp = req.get("x-customer-client-ip");
    const credential = req.get("x-customer-proxy-secret");
    if (claimedIp === undefined && credential === undefined) {
      next();
      return;
    }
    if (
      !expected ||
      !credential ||
      !/^[0-9a-f]{64}$/.test(credential) ||
      expected.length !== 64 ||
      !timingSafeEqual(expected, Buffer.from(credential)) ||
      !claimedIp ||
      !isIP(claimedIp)
    ) {
      next(
        new AppError(
          403,
          "CUSTOMER_PROXY_FORBIDDEN",
          "Invalid customer proxy credentials.",
        ),
      );
      return;
    }
    verifiedClientIps.set(req, claimedIp);
    next();
  });
  const customerRateKey = (req: Request) =>
    ipKeyGenerator(
      verifiedClientIps.get(req) ?? req.ip ?? req.socket.remoteAddress ?? "",
    );
  const activationLimiter = rateLimit({
    keyGenerator: customerRateKey,
    windowMs: 10 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
  });
  const orderLimiter = rateLimit({
    keyGenerator: customerRateKey,
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
