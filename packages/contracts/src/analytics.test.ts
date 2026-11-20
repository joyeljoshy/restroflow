import { describe, expect, it } from "vitest";

import {
  analyticsMoneySchema,
  analyticsRangeQuerySchema,
  popularItemsQuerySchema,
} from "./analytics.js";

describe("analytics contracts", () => {
  it("accepts an inclusive-start/exclusive-end range", () => {
    expect(
      analyticsRangeQuerySchema.parse({
        startDate: "2026-11-01",
        endDate: "2026-12-01",
      }),
    ).toEqual({
      startDate: "2026-11-01",
      endDate: "2026-12-01",
      granularity: "day",
    });
  });

  it("rejects reversed and unbounded ranges", () => {
    expect(() =>
      analyticsRangeQuerySchema.parse({
        startDate: "2026-11-20",
        endDate: "2026-11-20",
      }),
    ).toThrow();
    expect(() =>
      analyticsRangeQuerySchema.parse({
        startDate: "2025-01-01",
        endDate: "2026-12-31",
      }),
    ).toThrow();
  });

  it("bounds popular-item results and serializes aggregate money as digits", () => {
    expect(
      popularItemsQuerySchema.parse({
        startDate: "2026-11-01",
        endDate: "2026-12-01",
      }).limit,
    ).toBe(5);
    expect(analyticsMoneySchema.parse("9007199254740993")).toBe(
      "9007199254740993",
    );
    expect(() =>
      analyticsMoneySchema.parse(Number("9007199254740993")),
    ).toThrow();
  });
});
