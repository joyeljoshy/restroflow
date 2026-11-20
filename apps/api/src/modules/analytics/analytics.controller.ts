import type {
  AnalyticsRangeQuery,
  PopularItemsQuery,
} from "@restroflow/contracts";
import type { RequestHandler } from "express";

import type { AnalyticsServiceContract } from "./analytics.service.js";

export class AnalyticsController {
  constructor(private readonly service: AnalyticsServiceContract) {}

  private restaurantId(req: Parameters<RequestHandler>[0]): string {
    return req.restaurantAccess!.restaurantId;
  }

  overview: RequestHandler = async (req, res) => {
    const overview = await this.service.overview(
      this.restaurantId(req),
      req.query as unknown as AnalyticsRangeQuery,
    );
    res.status(200).json({ overview });
  };

  sales: RequestHandler = async (req, res) => {
    const sales = await this.service.sales(
      this.restaurantId(req),
      req.query as unknown as AnalyticsRangeQuery,
    );
    res.status(200).json({ sales });
  };

  payments: RequestHandler = async (req, res) => {
    const payments = await this.service.payments(
      this.restaurantId(req),
      req.query as unknown as AnalyticsRangeQuery,
    );
    res.status(200).json({ payments });
  };

  popularItems: RequestHandler = async (req, res) => {
    const popularItems = await this.service.popularItems(
      this.restaurantId(req),
      req.query as unknown as PopularItemsQuery,
    );
    res.status(200).json({ popularItems });
  };

  orders: RequestHandler = async (req, res) => {
    const orders = await this.service.orders(
      this.restaurantId(req),
      req.query as unknown as AnalyticsRangeQuery,
    );
    res.status(200).json({ orders });
  };

  tables: RequestHandler = async (req, res) => {
    const tables = await this.service.tables(
      this.restaurantId(req),
      req.query as unknown as AnalyticsRangeQuery,
    );
    res.status(200).json({ tables });
  };

  kitchen: RequestHandler = async (req, res) => {
    const kitchen = await this.service.kitchen(
      this.restaurantId(req),
      req.query as unknown as AnalyticsRangeQuery,
    );
    res.status(200).json({ kitchen });
  };
}
