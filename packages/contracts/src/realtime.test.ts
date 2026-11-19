import { describe, expect, it } from "vitest";

import {
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
});
