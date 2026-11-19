import type { Role } from "@restroflow/contracts";
import { expect, test, type Page, type Route } from "@playwright/test";

const restaurantId = "9010e67f-4aa1-428e-bc26-6de08366aab2";
const sessionId = "20000000-0000-4000-8000-000000000001";
const tableId = "10000000-0000-4000-8000-000000000001";
const billId = "30000000-0000-4000-8000-000000000001";
const timestamp = "2026-11-20T09:00:00.000Z";
const corsHeaders = {
  "access-control-allow-origin": "http://127.0.0.1:3100",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers":
    "content-type,x-restaurant-id,idempotency-key",
  "access-control-allow-methods": "GET,POST,OPTIONS",
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

function user(role: Role) {
  return {
    id: "f2bb8ad8-efb4-4d6a-a942-d31a4b432fb2",
    email: "cashier@example.com",
    displayName: "Test Cashier",
    memberships: [{ restaurantId, restaurantName: "RestroFlow Demo", role }],
  };
}

function preview() {
  return {
    tableSessionId: sessionId,
    currency: "INR",
    taxName: "GST",
    taxRateBasisPoints: 500,
    pricesIncludeTax: false,
    roundingPolicy: "PER_LINE_HALF_UP_V1",
    subtotalMinor: 27_000,
    taxMinor: 1_350,
    totalMinor: 28_350,
    canFinalize: true,
    blockingOrderCount: 0,
    restaurant: {
      id: restaurantId,
      name: "RestroFlow Demo",
      address: "1 Test Street",
      phone: null,
      email: null,
    },
    table: { id: tableId, tableNumber: "T1", displayName: "Window table" },
    items: [
      {
        sourceOrderItemId: "40000000-0000-4000-8000-000000000001",
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
            id: "50000000-0000-4000-8000-000000000001",
            modifierGroupNameSnapshot: "Extras",
            modifierNameSnapshot: "Extra chicken",
            modifierPriceMinor: 4_000,
            quantity: 1,
          },
        ],
      },
      {
        sourceOrderItemId: "40000000-0000-4000-8000-000000000002",
        orderNumberSnapshot: "ORD-102",
        itemNameSnapshot: "Fresh lime",
        quantity: 1,
        unitPriceMinor: 5_000,
        modifierSubtotalMinor: 0,
        lineSubtotalMinor: 5_000,
        taxAmountMinor: 250,
        finalLineAmountMinor: 5_250,
        batchNumber: 2,
        modifiers: [],
      },
    ],
  };
}

type Payment = {
  id: string;
  amountMinor: number;
  method: "CASH" | "UPI";
  status: "RECORDED";
  reference: string | null;
  note: string | null;
  recordedBy: { id: string; displayName: string };
  recordedAt: string;
  createdAt: string;
};

function makeBill(payments: Payment[] = []) {
  const amountPaidMinor = payments.reduce(
    (sum, payment) => sum + payment.amountMinor,
    0,
  );
  return {
    id: billId,
    tableSessionId: sessionId,
    billNumber: "RF-20261120-DEMO0001",
    status:
      amountPaidMinor === 28_350
        ? ("PAID" as const)
        : amountPaidMinor > 0
          ? ("PARTIALLY_PAID" as const)
          : ("FINALIZED" as const),
    version: payments.length + 1,
    currency: "INR",
    taxName: "GST",
    taxRateBasisPoints: 500,
    pricesIncludeTax: false,
    roundingPolicy: "PER_LINE_HALF_UP_V1",
    subtotalMinor: 27_000,
    taxMinor: 1_350,
    totalMinor: 28_350,
    amountPaidMinor,
    outstandingMinor: 28_350 - amountPaidMinor,
    restaurant: preview().restaurant,
    table: preview().table,
    createdBy: {
      id: "60000000-0000-4000-8000-000000000001",
      displayName: "Test Cashier",
    },
    finalizedBy: {
      id: "60000000-0000-4000-8000-000000000001",
      displayName: "Test Cashier",
    },
    items: preview().items.map((item, index) => ({
      ...item,
      id: `70000000-0000-4000-8000-00000000000${index + 1}`,
    })),
    payments,
    finalizedAt: timestamp,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function mockBilling(
  page: Page,
  options: { finalized?: boolean; role?: Role } = {},
) {
  let finalized = options.finalized ?? false;
  let closed = false;
  const payments: Payment[] = [];
  const idempotent = new Map<
    string,
    { payment: Payment; bill: ReturnType<typeof makeBill> }
  >();

  await page.route("**/api/v1/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === "/api/v1/auth/me") {
      await json(route, { user: user(options.role ?? "CASHIER") });
      return;
    }
    if (path === "/api/v1/billing/active-sessions") {
      await json(route, {
        sessions: closed
          ? []
          : [
              {
                tableSessionId: sessionId,
                table: preview().table,
                openedAt: timestamp,
                orderCount: 2,
                unresolvedOrderCount: 0,
                billingStatus: finalized
                  ? makeBill(payments).status
                  : "UNBILLED",
                billId: finalized ? billId : null,
                totalMinor: finalized ? 28_350 : null,
                outstandingMinor: finalized
                  ? makeBill(payments).outstandingMinor
                  : null,
                currency: "INR",
              },
            ],
      });
      return;
    }
    if (path === `/api/v1/table-sessions/${sessionId}/bill-preview`) {
      await json(route, { preview: preview() });
      return;
    }
    if (
      path === `/api/v1/table-sessions/${sessionId}/bills` &&
      request.method() === "POST"
    ) {
      finalized = true;
      await json(route, { bill: makeBill(payments) }, 201);
      return;
    }
    if (path === "/api/v1/bills") {
      await json(route, {
        bills: finalized ? [makeBill(payments)] : [],
        pagination: {
          page: 1,
          limit: 20,
          total: finalized ? 1 : 0,
          totalPages: finalized ? 1 : 0,
        },
      });
      return;
    }
    if (path === `/api/v1/bills/${billId}` && request.method() === "GET") {
      await json(route, { bill: makeBill(payments) });
      return;
    }
    if (
      path === `/api/v1/bills/${billId}/payments` &&
      request.method() === "POST"
    ) {
      const key = request.headers()["idempotency-key"] ?? "";
      const replay = idempotent.get(key);
      if (replay) {
        await json(route, replay, 201);
        return;
      }
      const input = request.postDataJSON() as {
        amountMinor: number;
        method: "CASH" | "UPI";
        reference?: string | null;
      };
      const current = makeBill(payments);
      if (
        input.amountMinor > current.outstandingMinor ||
        current.status === "PAID"
      ) {
        await json(
          route,
          {
            error: {
              code: "PAYMENT_EXCEEDS_BALANCE",
              message: "The payment exceeds the outstanding balance.",
            },
          },
          409,
        );
        return;
      }
      const payment: Payment = {
        id: `80000000-0000-4000-8000-${(payments.length + 1).toString().padStart(12, "0")}`,
        amountMinor: input.amountMinor,
        method: input.method,
        status: "RECORDED",
        reference: input.reference ?? null,
        note: null,
        recordedBy: {
          id: "60000000-0000-4000-8000-000000000001",
          displayName: "Test Cashier",
        },
        recordedAt: timestamp,
        createdAt: timestamp,
      };
      payments.push(payment);
      const result = { payment, bill: makeBill(payments) };
      idempotent.set(key, result);
      await json(route, result, 201);
      return;
    }
    if (
      path === `/api/v1/table-sessions/${sessionId}/close` &&
      request.method() === "POST"
    ) {
      closed = true;
      await json(route, {
        session: {
          id: sessionId,
          tableId,
          status: "CLOSED",
          openedAt: timestamp,
          closedAt: timestamp,
          openedBy: {
            id: "60000000-0000-4000-8000-000000000001",
            displayName: "Test Cashier",
          },
          closedBy: {
            id: "60000000-0000-4000-8000-000000000001",
            displayName: "Test Cashier",
          },
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      });
      return;
    }
    await json(
      route,
      { error: { code: "NOT_FOUND", message: "Not found." } },
      404,
    );
  });

  return {
    paymentCount: () => payments.length,
    isClosed: () => closed,
  };
}

test("cashier previews served orders and finalizes an immutable bill", async ({
  page,
}) => {
  await mockBilling(page);
  await page.goto("/cashier");
  await page
    .getByRole("button", { name: /Window table/ })
    .first()
    .click();
  await expect(page.getByText("Chicken biryani")).toBeVisible();
  await expect(page.getByText("Extra chicken")).toBeVisible();
  await page.getByRole("button", { name: "Finalize immutable bill" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Finalize bill" })
    .click();
  await expect(
    page
      .getByRole("article", { name: "RestroFlow Demo" })
      .getByText("RF-20261120-DEMO0001", { exact: true }),
  ).toBeVisible();
});

test("cashier records cash and UPI partial payments then closes the table", async ({
  page,
}) => {
  const state = await mockBilling(page, { finalized: true });
  await page.goto("/cashier");
  await page
    .getByRole("button", { name: /Window table/ })
    .first()
    .click();
  await page.getByLabel("Amount (INR)").fill("100.00");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Record cash payment" }).click();
  await expect(page.getByText("Partially paid").first()).toBeVisible();
  await page.getByLabel("Method").selectOption("UPI");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Record UPI payment" }).click();
  await expect(page.getByText("Paid").first()).toBeVisible();
  await page.getByRole("button", { name: "Close table" }).click();
  await expect(page.getByText("Paid table session closed.")).toBeVisible();
  expect(state.paymentCount()).toBe(2);
  expect(state.isClosed()).toBe(true);
});

test("cashier records a full cash payment and sees a paid receipt", async ({
  page,
}) => {
  const state = await mockBilling(page, { finalized: true });
  await page.goto("/cashier");
  await page
    .getByRole("button", { name: /Window table/ })
    .first()
    .click();
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Record cash payment" }).click();
  await expect(page.getByText("Paid").first()).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Recorded payments" }),
  ).toBeVisible();
  expect(state.paymentCount()).toBe(1);
});

test("payment retries with one idempotency key create one record", async ({
  page,
}) => {
  const state = await mockBilling(page, { finalized: true });
  await page.goto("/cashier");
  const statuses = await page.evaluate(
    async ({ id, restaurant }) => {
      const request = () =>
        fetch(`http://localhost:4000/api/v1/bills/${id}/payments`, {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-restaurant-id": restaurant,
            "idempotency-key": "same-payment-key",
          },
          body: JSON.stringify({
            amountMinor: 10_000,
            method: "CASH",
            receivedExternally: true,
          }),
        });
      return [(await request()).status, (await request()).status];
    },
    { id: billId, restaurant: restaurantId },
  );
  expect(statuses).toEqual([201, 201]);
  expect(state.paymentCount()).toBe(1);
});

test("cashier UI rejects overpayment and concurrent requests cannot exceed the bill", async ({
  page,
}) => {
  const state = await mockBilling(page, { finalized: true });
  await page.goto("/cashier");
  await page
    .getByRole("button", { name: /Window table/ })
    .first()
    .click();
  await page.getByLabel("Amount (INR)").fill("999.00");
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "Record cash payment" }).click();
  await expect(page.getByText("exceeds the outstanding balance")).toBeVisible();

  const statuses = await page.evaluate(
    async ({ id, restaurant }) => {
      const submit = (key: string) =>
        fetch(`http://localhost:4000/api/v1/bills/${id}/payments`, {
          method: "POST",
          credentials: "include",
          headers: {
            "content-type": "application/json",
            "x-restaurant-id": restaurant,
            "idempotency-key": key,
          },
          body: JSON.stringify({
            amountMinor: 28_350,
            method: "CASH",
            receivedExternally: true,
          }),
        });
      return Promise.all([submit("concurrent-a"), submit("concurrent-b")]).then(
        (responses) => responses.map((response) => response.status).sort(),
      );
    },
    { id: billId, restaurant: restaurantId },
  );
  expect(statuses).toEqual([201, 409]);
  expect(state.paymentCount()).toBe(1);
});

test("waiters cannot enter the cashier workspace", async ({ page }) => {
  await mockBilling(page, { role: "WAITER" });
  await page.goto("/cashier");
  await expect(page).toHaveURL(/\/unauthorized$/);
});
