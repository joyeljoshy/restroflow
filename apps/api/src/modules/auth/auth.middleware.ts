import type { Role } from "@restroflow/contracts";
import type { RequestHandler } from "express";

import { AppError } from "../../errors/app-error.js";
import { clearSessionCookie, readSessionToken } from "./auth.cookies.js";
import type { SessionCookieOptions } from "./auth.cookies.js";
import type { AuthServiceContract } from "./auth.service.js";

export function requireAuth(
  service: AuthServiceContract,
  cookieOptions: SessionCookieOptions,
): RequestHandler {
  return async (req, res, next) => {
    try {
      req.auth = await service.authenticate(readSessionToken(req));
      next();
    } catch (error) {
      clearSessionCookie(res, cookieOptions);
      next(error);
    }
  };
}

export const requireRestaurantAccess: RequestHandler = (req, _res, next) => {
  const restaurantId = req.params.restaurantId;
  const membership = req.auth.user.memberships.find(
    (candidate) => candidate.restaurantId === restaurantId,
  );

  if (!membership) {
    next(
      new AppError(
        403,
        "RESTAURANT_ACCESS_DENIED",
        "You do not have access to this restaurant.",
      ),
    );
    return;
  }

  req.restaurantAccess = membership;
  next();
};

export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.restaurantAccess || !roles.includes(req.restaurantAccess.role)) {
      next(
        new AppError(
          403,
          "ROLE_FORBIDDEN",
          "Your staff role cannot perform this action.",
        ),
      );
      return;
    }
    next();
  };
}
