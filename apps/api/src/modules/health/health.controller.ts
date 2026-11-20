import type { RequestHandler } from "express";

import type { HealthService } from "./health.service.js";

export class HealthController {
  constructor(private readonly service: HealthService) {}

  getHealth: RequestHandler = async (_req, res) => {
    const health = await this.service.check();
    res.status(health.status === "ok" ? 200 : 503).json(health);
  };

  getLiveness: RequestHandler = (_req, res) => {
    res.status(200).json(this.service.live());
  };

  getReadiness: RequestHandler = async (_req, res) => {
    const health = await this.service.check();
    res.status(health.status === "ok" ? 200 : 503).json(health);
  };
}
