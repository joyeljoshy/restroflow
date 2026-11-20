import { Router } from "express";

import type { HealthController } from "./health.controller.js";

export function createHealthRouter(controller: HealthController): Router {
  const router = Router();
  router.get("/", controller.getHealth);
  router.get("/live", controller.getLiveness);
  router.get("/ready", controller.getReadiness);
  return router;
}
