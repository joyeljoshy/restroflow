import { describe, expect, it } from "vitest";

import { billListQuerySchema, createPaymentRequestSchema } from "./billing.js";

describe("billing contracts", () => {
  it("requires a positive integer payment and explicit receipt confirmation", () => {
    expect(
      createPaymentRequestSchema.safeParse({
        amountMinor: 500,
        method: "CASH",
        receivedExternally: true,
      }).success,
    ).toBe(true);
    expect(
      createPaymentRequestSchema.safeParse({
        amountMinor: 0,
        method: "UPI",
        receivedExternally: true,
      }).success,
    ).toBe(false);
    expect(
      createPaymentRequestSchema.safeParse({
        amountMinor: 500,
        method: "UPI",
      }).success,
    ).toBe(false);
  });

  it("bounds billing history pagination", () => {
    expect(billListQuerySchema.parse({})).toEqual({ page: 1, limit: 20 });
    expect(billListQuerySchema.safeParse({ limit: 101 }).success).toBe(false);
  });
});
