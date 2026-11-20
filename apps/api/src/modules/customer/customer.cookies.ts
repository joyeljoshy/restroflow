import type { Request, Response } from "express";

import type { SessionCookieOptions } from "../auth/auth.cookies.js";

export const CUSTOMER_SESSION_COOKIE_NAME = "restroflow_customer_session";

export function readCustomerSessionToken(req: Request) {
  return readCustomerSessionTokenFromCookieHeader(req.headers.cookie);
}

export function readCustomerSessionTokenFromCookieHeader(
  header: string | undefined,
) {
  if (!header) return undefined;
  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (
      separator < 0 ||
      segment.slice(0, separator).trim() !== CUSTOMER_SESSION_COOKIE_NAME
    )
      continue;
    try {
      return decodeURIComponent(segment.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function setCustomerSessionCookie(
  res: Response,
  token: string,
  options: SessionCookieOptions,
) {
  res.cookie(CUSTOMER_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite ?? "lax",
    path: "/",
    maxAge: options.maxAgeMs,
  });
}

export function clearCustomerSessionCookie(
  res: Response,
  options: SessionCookieOptions,
) {
  res.clearCookie(CUSTOMER_SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: options.secure,
    sameSite: options.sameSite ?? "lax",
    path: "/",
  });
}
