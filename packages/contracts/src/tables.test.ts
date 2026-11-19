import { describe, expect, it } from "vitest";

import {
  createTableRequestSchema,
  tableListQuerySchema,
  updateTableRequestSchema,
} from "./tables.js";

describe("table contracts", () => {
  it("normalizes valid table input", () => {
    expect(
      createTableRequestSchema.parse({
        tableNumber: "  A-01 ",
        displayName: " Patio one ",
        capacity: 4,
      }),
    ).toEqual({
      tableNumber: "A-01",
      displayName: "Patio one",
      capacity: 4,
      isActive: true,
    });
  });

  it("requires positive capacity and non-empty updates", () => {
    expect(
      createTableRequestSchema.safeParse({
        tableNumber: "1",
        displayName: "One",
        capacity: 0,
      }).success,
    ).toBe(false);
    expect(updateTableRequestSchema.safeParse({}).success).toBe(false);
  });

  it("defaults table filters", () => {
    expect(tableListQuerySchema.parse({})).toEqual({ occupancy: "all" });
  });
});
