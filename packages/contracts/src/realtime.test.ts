import { describe, expect, it } from "vitest";

import {
  billChangedEventSchema,
  orderChangedEventSchema,
  realtimeSubscriptionSchema,
} from "./realtime";

describe("realtime contracts", () => {
  it("accepts minimal versioned invalidation events", () => {
    expect(
      orderChangedEventSchema.parse({
        eventId: "10000000-0000-4000-8000-000000000001",
        schemaVersion: 1,
        restaurantId: "20000000-0000-4000-8000-000000000001",
        orderId: "30000000-0000-4000-8000-000000000001",
        changeType: "ITEM_UPDATED",
        orderVersion: 4,
        occurredAt: "2026-11-19T10:00:00.000Z",
      }).orderVersion,
    ).toBe(4);
  });

  it("rejects restaurant identifiers in subscription payloads", () => {
    expect(
      realtimeSubscriptionSchema.safeParse({
        channel: "kitchen",
        restaurantId: "20000000-0000-4000-8000-000000000001",
      }).success,
    ).toBe(false);
  });

  it("accepts minimal versioned billing invalidations", () => {
    expect(
      billChangedEventSchema.parse({
        eventId: "10000000-0000-4000-8000-000000000001",
        schemaVersion: 1,
        restaurantId: "20000000-0000-4000-8000-000000000001",
        billId: "30000000-0000-4000-8000-000000000001",
        tableSessionId: "40000000-0000-4000-8000-000000000001",
        changeType: "PAYMENT_RECORDED",
        billVersion: 2,
        occurredAt: "2026-11-20T10:00:00.000Z",
      }).billVersion,
    ).toBe(2);
  });
});
