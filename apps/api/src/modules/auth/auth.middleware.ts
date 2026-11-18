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

export const resolveSessionRestaurant: RequestHandler = (req, _res, next) => {
  const requestedId = req.header("x-restaurant-id");
  const memberships = req.auth.user.memberships;
  const membership = requestedId
    ? memberships.find((candidate) => candidate.restaurantId === requestedId)
    : memberships.length === 1
      ? memberships[0]
      : undefined;

  if (!membership) {
    next(
      new AppError(
        requestedId ? 403 : 400,
        requestedId
          ? "RESTAURANT_ACCESS_DENIED"
          : "RESTAURANT_CONTEXT_REQUIRED",
        requestedId
          ? "You do not have access to this restaurant."
          : "Select a restaurant before accessing its menu.",
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
