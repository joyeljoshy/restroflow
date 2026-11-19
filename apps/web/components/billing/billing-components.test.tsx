import type { Bill } from "@restroflow/contracts";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BillItemList } from "./bill-item-list";
import { BillStatusBadge } from "./bill-status-badge";
import { paymentFormSchema } from "./payment-form";
import { ReceiptView } from "./receipt-view";
import { TaxBreakdown } from "./tax-breakdown";

const bill: Bill = {
  id: "10000000-0000-4000-8000-000000000001",
  tableSessionId: "10000000-0000-4000-8000-000000000002",
  billNumber: "RF-20261120-TEST0001",
  status: "PARTIALLY_PAID",
  version: 2,
  currency: "INR",
  taxName: "GST",
  taxRateBasisPoints: 500,
  pricesIncludeTax: false,
  roundingPolicy: "PER_LINE_HALF_UP_V1",
  subtotalMinor: 27_000,
  taxMinor: 1_350,
  totalMinor: 28_350,
  amountPaidMinor: 10_000,
  outstandingMinor: 18_350,
  restaurant: {
    id: "10000000-0000-4000-8000-000000000003",
    name: "RestroFlow Test Kitchen",
    address: "1 Test Street",
    phone: null,
    email: null,
  },
  table: {
    id: "10000000-0000-4000-8000-000000000004",
    tableNumber: "T1",
    displayName: "Window table",
  },
  createdBy: {
    id: "10000000-0000-4000-8000-000000000005",
    displayName: "Cashier",
  },
  finalizedBy: {
    id: "10000000-0000-4000-8000-000000000005",
    displayName: "Cashier",
  },
  items: [
    {
      id: "10000000-0000-4000-8000-000000000006",
      sourceOrderItemId: "10000000-0000-4000-8000-000000000007",
      orderNumberSnapshot: "ORD-101",
      itemNameSnapshot: "Chicken biryani",
      quantity: 1,
      unitPriceMinor: 18_000,
      modifierSubtotalMinor: 4_000,
      lineSubtotalMinor: 22_000,
      taxAmountMinor: 1_100,
      finalLineAmountMinor: 23_100,
      batchNumber: 1,
      modifiers: [
        {
          id: "10000000-0000-4000-8000-000000000008",
          modifierGroupNameSnapshot: "Extras",
          modifierNameSnapshot: "Extra chicken",
          modifierPriceMinor: 4_000,
          quantity: 1,
        },
      ],
    },
  ],
  payments: [
    {
      id: "10000000-0000-4000-8000-000000000009",
      amountMinor: 10_000,
      method: "CASH",
      status: "RECORDED",
      reference: null,
      note: null,
      recordedBy: {
        id: "10000000-0000-4000-8000-000000000005",
        displayName: "Cashier",
      },
      recordedAt: "2026-11-20T09:00:00.000Z",
      createdAt: "2026-11-20T09:00:00.000Z",
    },
  ],
  finalizedAt: "2026-11-20T08:55:00.000Z",
  createdAt: "2026-11-20T08:55:00.000Z",
  updatedAt: "2026-11-20T09:00:00.000Z",
};

describe("billing presentation", () => {
  it("renders status, item modifiers, tax, and outstanding balance", () => {
    const status = renderToStaticMarkup(
      createElement(BillStatusBadge, { status: "PARTIALLY_PAID" }),
    );
    const items = renderToStaticMarkup(
      createElement(BillItemList, { items: bill.items, currency: "INR" }),
    );
    const tax = renderToStaticMarkup(
      createElement(TaxBreakdown, {
        subtotalMinor: bill.subtotalMinor,
        taxMinor: bill.taxMinor,
        totalMinor: bill.totalMinor,
        taxName: bill.taxName,
        taxRateBasisPoints: bill.taxRateBasisPoints,
        pricesIncludeTax: bill.pricesIncludeTax,
        currency: bill.currency,
      }),
    );
    expect(status).toContain("Partially paid");
    expect(items).toContain("Chicken biryani");
    expect(items).toContain("Extra chicken");
    expect(tax).toContain("GST (5.00%)");
  });

  it("renders a historical receipt with manual-payment disclosure", () => {
    const markup = renderToStaticMarkup(createElement(ReceiptView, { bill }));
    expect(markup).toContain("RF-20261120-TEST0001");
    expect(markup).toContain("Recorded payments");
    expect(markup).toContain("Outstanding");
    expect(markup).toContain("recorded manually by staff");
  });

  it("requires a valid amount and explicit payment confirmation", () => {
    expect(
      paymentFormSchema.safeParse({
        amount: "400.00",
        method: "CASH",
        reference: "",
        confirmed: true,
      }).success,
    ).toBe(true);
    expect(
      paymentFormSchema.safeParse({
        amount: "0",
        method: "UPI",
        reference: "",
        confirmed: false,
      }).success,
    ).toBe(false);
  });
});
