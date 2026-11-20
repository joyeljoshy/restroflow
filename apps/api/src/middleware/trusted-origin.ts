import type { RequestHandler } from "express";

import { AppError } from "../errors/app-error.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export function requireTrustedOrigin(
  origins: readonly string[],
): RequestHandler {
  return (req, _res, next) => {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }

    const origin = req.header("origin");
    // Non-browser clients commonly omit Origin. Browser credentialed commands
    // always include it, including same-site requests that SameSite=Lax alone
    // does not protect.
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
