import { describe, expect, it } from "vitest";

import {
  activateCustomerSessionRequestSchema,
  customerCreateOrderRequestSchema,
  customerOrderChangedEventSchema,
} from "./index";

describe("customer ordering contracts", () => {
  it("accepts bounded activation input and rejects leaked extra fields", () => {
    expect(
      activateCustomerSessionRequestSchema.safeParse({
        identifier: "a".repeat(43),
        activationCode: "123456",
      }).success,
    ).toBe(true);
    expect(
      activateCustomerSessionRequestSchema.safeParse({
        identifier: "a".repeat(43),
        activationCode: "123456",
        restaurantId: "9010e67f-4aa1-428e-bc26-6de08366aab2",
      }).success,
    ).toBe(false);
  });

  it("does not accept a client table session in customer order input", () => {
    expect(
      customerCreateOrderRequestSchema.safeParse({
        tableSessionId: "9010e67f-4aa1-428e-bc26-6de08366aab2",
        items: [
          {
            menuItemId: "9010e67f-4aa1-428e-bc26-6de08366aab2",
            quantity: 1,
            modifierIds: [],
          },
        ],
      }).success,
    ).toBe(false);
  });

  it("keeps customer invalidations minimal", () => {
    expect(
      customerOrderChangedEventSchema.safeParse({
        eventId: "10000000-0000-4000-8000-000000000001",
        schemaVersion: 1,
        orderId: "20000000-0000-4000-8000-000000000001",
        orderVersion: 2,
        changeType: "STATUS_UPDATED",
        occurredAt: "2026-11-19T10:00:00.000Z",
        restaurantId: "30000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
  });
});
