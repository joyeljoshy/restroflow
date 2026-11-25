import { Router } from "express";

import type { AnalyticsController } from "../modules/analytics/analytics.controller.js";
import { createAnalyticsRouter } from "../modules/analytics/analytics.routes.js";
import type { AuthController } from "../modules/auth/auth.controller.js";
import type { SessionCookieOptions } from "../modules/auth/auth.cookies.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import type { AuthServiceContract } from "../modules/auth/auth.service.js";
import type { BillingController } from "../modules/billing/billing.controller.js";
import { createBillingRouter } from "../modules/billing/billing.routes.js";
import type { HealthController } from "../modules/health/health.controller.js";
import type { CustomerController } from "../modules/customer/customer.controller.js";
import { createCustomerRouter } from "../modules/customer/customer.routes.js";
import type { CustomerServiceContract } from "../modules/customer/customer.service.js";
import { createHealthRouter } from "../modules/health/health.routes.js";
import type { MenuController } from "../modules/menu/menu.controller.js";
import { createMenuRouter } from "../modules/menu/menu.routes.js";
import type { OrderController } from "../modules/orders/order.controller.js";
import { createOrderRouter } from "../modules/orders/order.routes.js";
import type { RestaurantController } from "../modules/restaurants/restaurant.controller.js";
import { createRestaurantRouter } from "../modules/restaurants/restaurant.routes.js";
import type { StaffController } from "../modules/staff/staff.controller.js";
import type { TableController } from "../modules/tables/table.controller.js";
import { createTableRouter } from "../modules/tables/table.routes.js";

export function createV1Router(
  healthController: HealthController,
  authController: AuthController,
  authService: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
  loginRateLimitMax: number,
  restaurantController: RestaurantController,
  staffController: StaffController,
  menuController?: MenuController,
  tableController?: TableController,
  orderController?: OrderController,
  customerController?: CustomerController,
  customerService?: CustomerServiceContract,
  customerCookieOptions?: SessionCookieOptions,
  allowedOrigins: string[] = [],
  billingController?: BillingController,
  analyticsController?: AnalyticsController,
  customerProxySecret?: string,
): Router {
  const router = Router();
  router.use(
    "/auth",
    createAuthRouter(
      authController,
      authService,
      cookieOptions,
      loginRateLimitMax,
    ),
  );
  router.use("/health", createHealthRouter(healthController));
  if (customerController && customerService && customerCookieOptions) {
    router.use(
      createCustomerRouter(
        customerController,
        customerService,
        authService,
        cookieOptions,
        customerCookieOptions,
        allowedOrigins,
        customerProxySecret,
      ),
    );
  }
  router.use(
    "/restaurants",
    createRestaurantRouter(
      restaurantController,
      staffController,
      authService,
      cookieOptions,
    ),
  );
  if (menuController) {
    router.use(
      "/menu",
      createMenuRouter(menuController, authService, cookieOptions),
    );
  }
  if (tableController) {
    router.use(createTableRouter(tableController, authService, cookieOptions));
  }
  if (orderController) {
    router.use(createOrderRouter(orderController, authService, cookieOptions));
  }
  if (billingController) {
    router.use(
      createBillingRouter(billingController, authService, cookieOptions),
    );
  }
  if (analyticsController) {
    router.use(
      "/analytics",
      createAnalyticsRouter(analyticsController, authService, cookieOptions),
    );
  }
  return router;
}
