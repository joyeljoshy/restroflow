import { describe, expect, it } from "vitest";

import { healthResponseSchema, livenessResponseSchema } from "./health.js";

describe("healthResponseSchema", () => {
  it("accepts the public health contract", () => {
    expect(
      healthResponseSchema.safeParse({
        status: "ok",
        service: "restroflow-api",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
        checks: { database: "up" },
      }).success,
    ).toBe(true);
  });

  it("accepts the liveness contract without infrastructure details", () => {
    expect(
      livenessResponseSchema.safeParse({
        status: "ok",
        service: "restroflow-api",
        version: "0.1.0",
        timestamp: new Date().toISOString(),
      }).success,
    ).toBe(true);
  });
});
