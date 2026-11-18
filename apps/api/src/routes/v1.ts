import { Router } from "express";

import type { AuthController } from "../modules/auth/auth.controller.js";
import type { SessionCookieOptions } from "../modules/auth/auth.cookies.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import type { AuthServiceContract } from "../modules/auth/auth.service.js";
import type { HealthController } from "../modules/health/health.controller.js";
import { createHealthRouter } from "../modules/health/health.routes.js";
import type { MenuController } from "../modules/menu/menu.controller.js";
import { createMenuRouter } from "../modules/menu/menu.routes.js";
import type { RestaurantController } from "../modules/restaurants/restaurant.controller.js";
import { createRestaurantRouter } from "../modules/restaurants/restaurant.routes.js";
import type { StaffController } from "../modules/staff/staff.controller.js";

export function createV1Router(
  healthController: HealthController,
  authController: AuthController,
  authService: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
  loginRateLimitMax: number,
  restaurantController: RestaurantController,
  staffController: StaffController,
  menuController?: MenuController,
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
  return router;
}
