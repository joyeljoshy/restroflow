import type { RequestHandler } from "express";

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
