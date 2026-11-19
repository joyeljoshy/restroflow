import { beforeEach, describe, expect, it } from "vitest";

import {
  cartEstimatedTotal,
  cartLineKey,
  cartLineTotal,
  useOrderCartStore,
  type NewCartLine,
} from "./order-cart-store";

const line: NewCartLine = {
  menuItemId: "10000000-0000-4000-8000-000000000001",
  name: "Paneer Bowl",
  imageUrl: null,
  unitPriceMinor: 12_000,
  quantity: 2,
  modifiers: [
    {
      id: "10000000-0000-4000-8000-000000000002",
      groupId: "10000000-0000-4000-8000-000000000003",
      groupName: "Protein",
      name: "Extra paneer",
      priceDeltaMinor: 2_500,
    },
  ],
  specialInstructions: null,
};

describe("waiter order cart", () => {
  beforeEach(() => useOrderCartStore.getState().clear());

  it("calculates estimated line and cart totals using integer minor units", () => {
    const withKey = { ...line, key: cartLineKey(line) };
    expect(cartLineTotal(withKey)).toBe(29_000);
    expect(cartEstimatedTotal([withKey])).toBe(29_000);
  });

  it("merges identical configurations and separates different modifiers", () => {
    useOrderCartStore.getState().addLine(line);
    useOrderCartStore.getState().addLine({ ...line, quantity: 1 });
    useOrderCartStore.getState().addLine({
      ...line,
      quantity: 1,
      modifiers: [],
    });
    const lines = useOrderCartStore.getState().lines;
    expect(lines).toHaveLength(2);
    expect(lines.find((item) => item.modifiers.length > 0)?.quantity).toBe(3);
  });

  it("updates quantities and removes zero-quantity lines", () => {
    useOrderCartStore.getState().addLine(line);
    const key = useOrderCartStore.getState().lines[0]!.key;
    useOrderCartStore.getState().setQuantity(key, 4);
    expect(useOrderCartStore.getState().lines[0]?.quantity).toBe(4);
    useOrderCartStore.getState().setQuantity(key, 0);
    expect(useOrderCartStore.getState().lines).toEqual([]);
  });
});
