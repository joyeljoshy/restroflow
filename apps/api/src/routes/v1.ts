import { Router } from "express";

import type { HealthController } from "../modules/health/health.controller.js";
import { createHealthRouter } from "../modules/health/health.routes.js";

export function createV1Router(healthController: HealthController): Router {
  const router = Router();
  router.use("/health", createHealthRouter(healthController));
  return router;
}
