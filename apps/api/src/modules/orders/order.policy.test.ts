import { describe, expect, it } from "vitest";

import {
  aggregatePreparationStatus,
  canRoleSetOrderStatus,
  itemTransitions,
  orderTransitions,
} from "./order.policy.js";

describe("kitchen order lifecycle policy", () => {
  it("requires the full kitchen flow before service", () => {
    expect(orderTransitions.PENDING).toContain("ACCEPTED");
    expect(orderTransitions.ACCEPTED).toEqual(["PREPARING", "CANCELLED"]);
    expect(orderTransitions.ACCEPTED).not.toContain("SERVED");
    expect(orderTransitions.PREPARING).toContain("READY");
    expect(orderTransitions.READY).toContain("SERVED");
  });

  it("prevents terminal orders and items from re-entering preparation", () => {
    expect(orderTransitions.CANCELLED).toEqual([]);
    expect(orderTransitions.REJECTED).toEqual([]);
    expect(orderTransitions.SERVED).toEqual([]);
    expect(itemTransitions.CANCELLED).toEqual([]);
    expect(itemTransitions.SERVED).toEqual([]);
  });

  it("aggregates active items without letting cancelled items block readiness", () => {
    expect(aggregatePreparationStatus("ACCEPTED", ["PENDING", "PENDING"])).toBe(
      "ACCEPTED",
    );
    expect(aggregatePreparationStatus("ACCEPTED", ["READY", "PENDING"])).toBe(
      "PREPARING",
    );
    expect(
      aggregatePreparationStatus("PREPARING", ["READY", "CANCELLED"]),
    ).toBe("READY");
    expect(
      aggregatePreparationStatus("PREPARING", ["CANCELLED", "CANCELLED"]),
    ).toBe("CANCELLED");
  });

  it("keeps role responsibilities separate", () => {
    expect(canRoleSetOrderStatus("KITCHEN", "READY")).toBe(true);
    expect(canRoleSetOrderStatus("KITCHEN", "SERVED")).toBe(false);
    expect(canRoleSetOrderStatus("WAITER", "SERVED")).toBe(true);
    expect(canRoleSetOrderStatus("CASHIER", "ACCEPTED")).toBe(false);
  });
});
