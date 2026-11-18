import { loginRequestSchema } from "@restroflow/contracts";
import { Router } from "express";
import { rateLimit } from "express-rate-limit";

import { AppError } from "../../errors/app-error.js";
import { validateRequest } from "../../middleware/validate-request.js";
import type { AuthController } from "./auth.controller.js";
import type { SessionCookieOptions } from "./auth.cookies.js";
import { requireAuth } from "./auth.middleware.js";
import type { AuthServiceContract } from "./auth.service.js";

export function createAuthRouter(
  controller: AuthController,
  service: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
  loginRateLimitMax: number,
): Router {
  const router = Router();
  const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: loginRateLimitMax,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler(_req, _res, next) {
      next(
        new AppError(
          429,
          "LOGIN_RATE_LIMITED",
          "Too many login attempts. Try again later.",
        ),
      );
    },
  });

  router.post(
    "/login",
    loginLimiter,
    validateRequest({ body: loginRequestSchema }),
    controller.login,
  );
  router.post("/logout", controller.logout);
  router.get(
    "/me",
    requireAuth(service, cookieOptions),
    controller.currentUser,
  );
  return router;
}
