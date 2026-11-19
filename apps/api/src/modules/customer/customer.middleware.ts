import type { RequestHandler } from "express";

import { AppError } from "../../errors/app-error.js";
import type { SessionCookieOptions } from "../auth/auth.cookies.js";
import {
  clearCustomerSessionCookie,
  readCustomerSessionToken,
} from "./customer.cookies.js";
import type { CustomerServiceContract } from "./customer.service.js";

export function requireCustomerSession(
  service: CustomerServiceContract,
  cookieOptions: SessionCookieOptions,
): RequestHandler {
  return async (req, res, next) => {
    try {
      req.customerSession = await service.authenticate(
        readCustomerSessionToken(req),
      );
      next();
    } catch (error) {
      clearCustomerSessionCookie(res, cookieOptions);
      next(error);
    }
  };
}

export function requireTrustedOrigin(
  origins: readonly string[],
): RequestHandler {
  return (req, _res, next) => {
    const origin = req.header("origin");
    if (origin && !origins.includes(origin)) {
      next(
        new AppError(
          403,
          "ORIGIN_FORBIDDEN",
          "This request origin is not allowed.",
        ),
      );
      return;
    }
    next();
  };
}
