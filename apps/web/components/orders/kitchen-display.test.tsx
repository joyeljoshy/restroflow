import type { Order } from "@restroflow/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { KitchenTicketCard } from "./kitchen-display";

const timestamp = "2026-11-19T09:00:00.000Z";
const order: Order = {
  id: "10000000-0000-4000-8000-000000000001",
  tableSessionId: "20000000-0000-4000-8000-000000000001",
  table: {
    id: "30000000-0000-4000-8000-000000000001",
    tableNumber: "T4",
    displayName: "Garden table",
  },
  orderNumber: "RF-20261119-KITCHEN",
  source: "WAITER",
  status: "PENDING",
  version: 1,
  totalMinor: 12_500,
  createdBy: {
    id: "40000000-0000-4000-8000-000000000001",
    displayName: "Floor Waiter",
  },
  items: [
    {
      id: "50000000-0000-4000-8000-000000000001",
      menuItemId: "60000000-0000-4000-8000-000000000001",
      itemNameSnapshot: "Paneer Bowl",
      quantity: 2,
      unitPriceMinor: 5_000,
      lineTotalMinor: 12_500,
      specialInstructions: "No onion",
      status: "PENDING",
      batchNumber: 2,
      modifiers: [
        {
          id: "70000000-0000-4000-8000-000000000001",
          modifierGroupId: null,
          modifierId: null,
          modifierGroupNameSnapshot: "Protein",
          modifierNameSnapshot: "Extra paneer",
          modifierPriceMinor: 1_250,
          quantity: 1,
        },
      ],
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ],
  createdAt: timestamp,
  updatedAt: timestamp,
};

describe("kitchen ticket presentation", () => {
  it("renders operational snapshots, batches, modifiers, and instructions", () => {
    const markup = renderToStaticMarkup(
      createElement(KitchenTicketCard, { order }),
    );
    expect(markup).toContain("RF-20261119-KITCHEN");
    expect(markup).toContain("Garden table");
    expect(markup).toContain("2 × Paneer Bowl");
    expect(markup).toContain("Batch 2");
    expect(markup).toContain("Extra paneer");
    expect(markup).toContain("No onion");
    expect(markup).toContain("NEW");
  });
});
