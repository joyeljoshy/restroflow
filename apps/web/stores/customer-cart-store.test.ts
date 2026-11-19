import { beforeEach, describe, expect, it } from "vitest";

import { useCustomerCartStore } from "./customer-cart-store";

const line = {
  menuItemId: "10000000-0000-4000-8000-000000000001",
  name: "Paneer Bowl",
  imageUrl: null,
  unitPriceMinor: 10_000,
  quantity: 1,
  modifiers: [],
  specialInstructions: null,
};

describe("customer cart isolation", () => {
  beforeEach(() => useCustomerCartStore.setState({ scope: null, lines: [] }));

  it("preserves a cart in the same QR scope and clears it for another table", () => {
    useCustomerCartStore.getState().ensureScope("table-one");
    useCustomerCartStore.getState().addLine(line);
    useCustomerCartStore.getState().ensureScope("table-one");
    expect(useCustomerCartStore.getState().lines).toHaveLength(1);
    useCustomerCartStore.getState().ensureScope("table-two");
    expect(useCustomerCartStore.getState().lines).toEqual([]);
  });

  it("merges identical configurations but separates instructions", () => {
    useCustomerCartStore.getState().ensureScope("table-one");
    useCustomerCartStore.getState().addLine(line);
    useCustomerCartStore.getState().addLine(line);
    useCustomerCartStore.getState().addLine({
      ...line,
      specialInstructions: "No onion",
    });
    expect(useCustomerCartStore.getState().lines).toHaveLength(2);
    expect(useCustomerCartStore.getState().lines[0]?.quantity).toBe(2);
  });
});
