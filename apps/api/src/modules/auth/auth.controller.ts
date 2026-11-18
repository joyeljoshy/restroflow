import type { LoginRequest } from "@restroflow/contracts";
import type { RequestHandler } from "express";

import {
  clearSessionCookie,
  readSessionToken,
  setSessionCookie,
  type SessionCookieOptions,
} from "./auth.cookies.js";
import type { AuthServiceContract } from "./auth.service.js";

export class AuthController {
  constructor(
    private readonly service: AuthServiceContract,
    private readonly cookieOptions: SessionCookieOptions,
  ) {}

  login: RequestHandler = async (req, res) => {
    const result = await this.service.login(req.body as LoginRequest);
    setSessionCookie(res, result.sessionToken, this.cookieOptions);
    res.status(200).json({ user: result.user });
  };

  logout: RequestHandler = async (req, res) => {
    await this.service.logout(readSessionToken(req));
    clearSessionCookie(res, this.cookieOptions);
    res.status(204).send();
  };

  currentUser: RequestHandler = (req, res) => {
    res.status(200).json({ user: req.auth.user });
  };
}
