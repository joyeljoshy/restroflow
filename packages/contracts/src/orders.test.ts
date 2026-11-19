import { describe, expect, it } from "vitest";

import {
  addOrderItemsRequestSchema,
  createOrderRequestSchema,
  kitchenTicketListQuerySchema,
  orderListQuerySchema,
  updateOrderItemStatusRequestSchema,
  updateOrderStatusRequestSchema,
} from "./orders";

const menuItemId = "10000000-0000-4000-8000-000000000001";
const modifierId = "10000000-0000-4000-8000-000000000002";
const tableSessionId = "10000000-0000-4000-8000-000000000003";

describe("order contracts", () => {
  it("accepts a bounded waiter order and defaults modifier selections", () => {
    const result = createOrderRequestSchema.parse({
      tableSessionId,
      items: [{ menuItemId, quantity: 2 }],
    });
    expect(result.items[0]?.modifierIds).toEqual([]);
  });

  it("rejects duplicate modifiers and empty orders", () => {
    expect(
      createOrderRequestSchema.safeParse({
        tableSessionId,
        items: [
          {
            menuItemId,
            quantity: 1,
            modifierIds: [modifierId, modifierId],
          },
        ],
      }).success,
    ).toBe(false);
    expect(
      createOrderRequestSchema.safeParse({ tableSessionId, items: [] }).success,
    ).toBe(false);
  });

  it("requires optimistic versions for item and status mutations", () => {
    expect(
      addOrderItemsRequestSchema.safeParse({
        version: 0,
        items: [{ menuItemId, quantity: 1 }],
      }).success,
    ).toBe(false);
    expect(
      updateOrderStatusRequestSchema.safeParse({
        version: 1,
        status: "ACCEPTED",
      }).success,
    ).toBe(true);
    expect(
      updateOrderItemStatusRequestSchema.safeParse({
        version: 2,
        status: "READY",
      }).success,
    ).toBe(true);
  });

  it("normalizes list pagination", () => {
    expect(
      orderListQuerySchema.parse({ page: "2", limit: "25" }),
    ).toMatchObject({ page: 2, limit: 25 });
  });

  it("bounds and normalizes kitchen status filters", () => {
    expect(
      kitchenTicketListQuerySchema.parse({
        limit: "40",
        statuses: "PENDING,PREPARING,READY",
      }),
    ).toEqual({
      limit: 40,
      statuses: ["PENDING", "PREPARING", "READY"],
    });
    expect(kitchenTicketListQuerySchema.safeParse({ limit: 101 }).success).toBe(
      false,
    );
  });
});
