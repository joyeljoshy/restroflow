import {
  idempotencyKeySchema,
  type CustomerCreateOrderRequest,
} from "@restroflow/contracts";
import type { RequestHandler } from "express";

import type { SessionCookieOptions } from "../auth/auth.cookies.js";
import {
  clearCustomerSessionCookie,
  readCustomerSessionToken,
  setCustomerSessionCookie,
} from "./customer.cookies.js";
import type { CustomerServiceContract } from "./customer.service.js";

export class CustomerController {
  constructor(
    private readonly service: CustomerServiceContract,
    private readonly cookieOptions: SessionCookieOptions,
  ) {}

  getTable: RequestHandler = async (req, res) => {
    res.status(200).json({
      context: await this.service.getPublicTable(
        req.params.identifier as string,
      ),
    });
  };

  getMenu: RequestHandler = async (req, res) => {
    res
      .status(200)
      .json(await this.service.getPublicMenu(req.params.identifier as string));
  };

  issueActivation: RequestHandler = async (req, res) => {
    const activation = await this.service.issueActivation(
      req.restaurantAccess!.restaurantId,
      req.params.id as string,
    );
    res.status(201).json({ activation });
  };

  activate: RequestHandler = async (req, res) => {
    const body = req.body as { identifier: string; activationCode: string };
    const result = await this.service.activate(
      body.identifier,
      body.activationCode,
    );
    setCustomerSessionCookie(res, result.sessionToken, this.cookieOptions);
    res.status(201).json({ session: result.session });
  };

  getSession: RequestHandler = (req, res) => {
    const session = req.customerSession!;
    res.status(200).json({
      session: {
        restaurantName: session.restaurantName,
        tableDisplayName: session.tableDisplayName,
        expiresAt: session.expiresAt.toISOString(),
      },
    });
  };

  logout: RequestHandler = async (req, res) => {
    await this.service.logout(readCustomerSessionToken(req));
    clearCustomerSessionCookie(res, this.cookieOptions);
    res.status(204).end();
  };

  createOrder: RequestHandler = async (req, res) => {
    const order = await this.service.createOrder(
      req.customerSession!,
      idempotencyKeySchema.parse(req.header("idempotency-key")),
      req.body as CustomerCreateOrderRequest,
    );
    res.status(201).json({ order });
  };

  listOrders: RequestHandler = async (req, res) => {
    res.status(200).json({
      orders: await this.service.listOrders(req.customerSession!),
    });
  };

  getOrder: RequestHandler = async (req, res) => {
    res.status(200).json({
      order: await this.service.getOrder(
        req.customerSession!,
        req.params.id as string,
      ),
    });
  };
}
