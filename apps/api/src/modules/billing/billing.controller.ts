import {
  idempotencyKeySchema,
  type BillListQuery,
  type CreatePaymentRequest,
} from "@restroflow/contracts";
import type { RequestHandler } from "express";

import type { BillingServiceContract } from "./billing.service.js";

export class BillingController {
  constructor(private readonly service: BillingServiceContract) {}

  private scope(req: Parameters<RequestHandler>[0]) {
    return req.restaurantAccess!;
  }

  listActiveSessions: RequestHandler = async (req, res) => {
    const sessions = await this.service.listActiveSessions(
      this.scope(req).restaurantId,
    );
    res.status(200).json({ sessions });
  };

  preview: RequestHandler = async (req, res) => {
    const preview = await this.service.preview(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ preview });
  };

  finalize: RequestHandler = async (req, res) => {
    const scope = this.scope(req);
    const bill = await this.service.finalize(
      scope.restaurantId,
      scope.id,
      req.params.id as string,
    );
    res.status(201).json({ bill });
  };

  listBills: RequestHandler = async (req, res) => {
    const result = await this.service.listBills(
      this.scope(req).restaurantId,
      req.query as unknown as BillListQuery,
    );
    res.status(200).json(result);
  };

  getBill: RequestHandler = async (req, res) => {
    const bill = await this.service.getBill(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ bill });
  };

  getBillBySession: RequestHandler = async (req, res) => {
    const bill = await this.service.getBillBySession(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ bill });
  };

  getReceipt: RequestHandler = async (req, res) => {
    const bill = await this.service.getBill(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ bill });
  };

  listPayments: RequestHandler = async (req, res) => {
    const payments = await this.service.listPayments(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ payments });
  };

  recordPayment: RequestHandler = async (req, res) => {
    const scope = this.scope(req);
    const result = await this.service.recordPayment(
      scope.restaurantId,
      scope.id,
      req.params.id as string,
      idempotencyKeySchema.parse(req.header("idempotency-key")),
      req.body as CreatePaymentRequest,
    );
    res.status(201).json(result);
  };
}
