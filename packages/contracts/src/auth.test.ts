import { describe, expect, it } from "vitest";

import { authResponseSchema, loginRequestSchema, roleSchema } from "./auth.js";

describe("authentication contracts", () => {
  it("normalizes login email addresses", () => {
    expect(
      loginRequestSchema.parse({
        email: "  Admin@Example.COM ",
        password: "correct horse battery staple",
      }).email,
    ).toBe("admin@example.com");
  });

  it("defines every staff role", () => {
    expect(roleSchema.options).toEqual([
      "ADMIN",
      "MANAGER",
      "WAITER",
      "KITCHEN",
      "CASHIER",
    ]);
  });

  it("accepts an authenticated staff response", () => {
    expect(
      authResponseSchema.safeParse({
        user: {
          id: "f2bb8ad8-efb4-4d6a-a942-d31a4b432fb2",
          email: "admin@example.com",
          displayName: "Admin",
          memberships: [
            {
              restaurantId: "9010e67f-4aa1-428e-bc26-6de08366aab2",
              restaurantName: "RestroFlow Demo",
              role: "ADMIN",
            },
          ],
        },
      }).success,
    ).toBe(true);
  });
});
