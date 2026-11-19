import {
  idempotencyKeySchema,
  type AddOrderItemsRequest,
  type CreateOrderRequest,
  type OrderListQuery,
  type UpdateOrderStatusRequest,
} from "@restroflow/contracts";
import type { RequestHandler } from "express";

import type { OrderServiceContract } from "./order.service.js";

export class OrderController {
  constructor(private readonly service: OrderServiceContract) {}

  private scope(req: Parameters<RequestHandler>[0]) {
    return req.restaurantAccess!;
  }

  private idempotencyKey(req: Parameters<RequestHandler>[0]) {
    return idempotencyKeySchema.parse(req.header("idempotency-key"));
  }

  createOrder: RequestHandler = async (req, res) => {
    const scope = this.scope(req);
    const order = await this.service.createOrder(
      scope.restaurantId,
      scope.id,
      this.idempotencyKey(req),
      req.body as CreateOrderRequest,
    );
    res.status(201).json({ order });
  };

  listOrders: RequestHandler = async (req, res) => {
    const result = await this.service.listOrders(
      this.scope(req).restaurantId,
      req.query as unknown as OrderListQuery,
    );
    res.status(200).json(result);
  };

  getOrder: RequestHandler = async (req, res) => {
    const order = await this.service.getOrder(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ order });
  };

  addItems: RequestHandler = async (req, res) => {
    const scope = this.scope(req);
    const order = await this.service.addItems(
      scope.restaurantId,
      scope.id,
      req.params.id as string,
      this.idempotencyKey(req),
      req.body as AddOrderItemsRequest,
    );
    res.status(200).json({ order });
  };

  updateStatus: RequestHandler = async (req, res) => {
    const scope = this.scope(req);
    const order = await this.service.updateStatus(
      scope.restaurantId,
      scope.id,
      scope.role,
      req.params.id as string,
      req.body as UpdateOrderStatusRequest,
    );
    res.status(200).json({ order });
  };

  listHistory: RequestHandler = async (req, res) => {
    const history = await this.service.listHistory(
      this.scope(req).restaurantId,
      req.params.id as string,
    );
    res.status(200).json({ history });
  };
}
