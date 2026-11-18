import { describe, expect, it } from "vitest";

import {
  createStaffRequestSchema,
  staffListQuerySchema,
  updateRestaurantRequestSchema,
  updateStaffRequestSchema,
} from "./index.js";

describe("restaurant and staff contracts", () => {
  it("normalizes restaurant settings without accepting unknown fields", () => {
    const result = updateRestaurantRequestSchema.parse({
      name: "  Cafe Aurora ",
      slug: "Cafe-Aurora",
      address: "",
      phone: null,
      email: "",
      timezone: "Asia/Kolkata",
      currency: "inr",
      taxName: "GST",
      taxRateBasisPoints: 1800,
      pricesIncludeTax: true,
    });

    expect(result).toMatchObject({
      name: "Cafe Aurora",
      slug: "cafe-aurora",
      address: null,
      email: null,
      currency: "INR",
    });
    expect(
      updateRestaurantRequestSchema.safeParse({ ...result, restaurantId: "x" })
        .success,
    ).toBe(false);
  });

  it("validates staff creation and query filters", () => {
    expect(
      createStaffRequestSchema.parse({
        displayName: "  Priya Shah ",
        email: " PRIYA@EXAMPLE.COM ",
        password: "a-secure-development-password",
        role: "MANAGER",
      }).email,
    ).toBe("priya@example.com");
    expect(staffListQuerySchema.parse({}).status).toBe("active");
  });

  it("rejects empty staff updates", () => {
    expect(updateStaffRequestSchema.safeParse({}).success).toBe(false);
  });
});
