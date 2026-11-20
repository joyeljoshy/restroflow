import {
  analyticsRangeQuerySchema,
  popularItemsQuerySchema,
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
import type { AnalyticsController } from "./analytics.controller.js";

export function createAnalyticsRouter(
  controller: AnalyticsController,
  authService: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
): Router {
  const router = Router();
  router.use(
    requireAuth(authService, cookieOptions),
    resolveSessionRestaurant,
    requireRole("ADMIN", "MANAGER"),
  );
  router.get(
    "/overview",
    validateRequest({ query: analyticsRangeQuerySchema }),
    controller.overview,
  );
  router.get(
    "/sales",
    validateRequest({ query: analyticsRangeQuerySchema }),
    controller.sales,
  );
  router.get(
    "/payments",
    validateRequest({ query: analyticsRangeQuerySchema }),
    controller.payments,
  );
  router.get(
    "/popular-items",
    validateRequest({ query: popularItemsQuerySchema }),
    controller.popularItems,
  );
  router.get(
    "/orders",
    validateRequest({ query: analyticsRangeQuerySchema }),
    controller.orders,
  );
  router.get(
    "/tables",
    validateRequest({ query: analyticsRangeQuerySchema }),
    controller.tables,
  );
  router.get(
    "/kitchen",
    validateRequest({ query: analyticsRangeQuerySchema }),
    controller.kitchen,
  );
  return router;
}
