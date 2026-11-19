import type { Request, Response } from "express";

export const SESSION_COOKIE_NAME = "restroflow_session";

export type SessionCookieOptions = {
  secure: boolean;
  maxAgeMs: number;
};

export function readSessionToken(req: Request): string | undefined {
  return readSessionTokenFromCookieHeader(req.headers.cookie);
}

export function readSessionTokenFromCookieHeader(
  header: string | undefined,
): string | undefined {
  if (!header) return undefined;

  for (const segment of header.split(";")) {
    const separator = segment.indexOf("=");
    if (separator < 0) continue;
    const name = segment.slice(0, separator).trim();
    if (name !== SESSION_COOKIE_NAME) continue;
    const value = segment.slice(separator + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return undefined;
    }
  }
  return undefined;
}

export function setSessionCookie(
  res: Response,
  token: string,
  options: SessionCookieOptions,
): void {
  res.cookie(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax",
    path: "/",
    maxAge: options.maxAgeMs,
  });
}

export function clearSessionCookie(
  res: Response,
  options: SessionCookieOptions,
): void {
  res.clearCookie(SESSION_COOKIE_NAME, {
    httpOnly: true,
    secure: options.secure,
    sameSite: "lax",
    path: "/",
  });
}
