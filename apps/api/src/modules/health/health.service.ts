import type { HealthResponse, LivenessResponse } from "@restroflow/contracts";

import type { HealthRepository } from "./health.repository.js";

export class HealthService {
  constructor(
    private readonly repository: HealthRepository,
    private readonly version: string,
  ) {}

  async check(): Promise<HealthResponse> {
    const databaseAvailable = await this.repository.isDatabaseAvailable();
    return {
      status: databaseAvailable ? "ok" : "degraded",
      service: "restroflow-api",
      version: this.version,
      timestamp: new Date().toISOString(),
      checks: { database: databaseAvailable ? "up" : "down" },
    };
  }

  live(): LivenessResponse {
    return {
      status: "ok",
      service: "restroflow-api",
      version: this.version,
      timestamp: new Date().toISOString(),
    };
  }
}
