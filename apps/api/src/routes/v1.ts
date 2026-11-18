import { Router } from "express";

import type { AuthController } from "../modules/auth/auth.controller.js";
import type { SessionCookieOptions } from "../modules/auth/auth.cookies.js";
import { createAuthRouter } from "../modules/auth/auth.routes.js";
import type { AuthServiceContract } from "../modules/auth/auth.service.js";
import type { HealthController } from "../modules/health/health.controller.js";
import { createHealthRouter } from "../modules/health/health.routes.js";

export function createV1Router(
  healthController: HealthController,
  authController: AuthController,
  authService: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
  loginRateLimitMax: number,
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
  return router;
}
