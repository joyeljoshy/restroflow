import { expect, test, type Page, type Route } from "@playwright/test";

const restaurantId = "9010e67f-4aa1-428e-bc26-6de08366aab2";
const sessionId = "20000000-0000-4000-8000-000000000001";
const tableId = "10000000-0000-4000-8000-000000000001";
const itemId = "40000000-0000-4000-8000-000000000001";
const modifierId = "50000000-0000-4000-8000-000000000001";
const timestamp = "2026-11-19T09:00:00.000Z";
const corsHeaders = {
  "access-control-allow-origin": "http://127.0.0.1:3100",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers":
    "content-type,x-restaurant-id,idempotency-key",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

function user() {
  return {
    id: "f2bb8ad8-efb4-4d6a-a942-d31a4b432fb2",
    email: "waiter@example.com",
    displayName: "Floor Waiter",
    memberships: [
      {
        restaurantId,
        restaurantName: "RestroFlow Demo",
        role: "WAITER" as const,
      },
    ],
  };
}

function table() {
  return {
    id: tableId,
    tableNumber: "T1",
    displayName: "Window table",
    capacity: 4,
    isActive: true,
    occupancy: "OCCUPIED",
    activeSession: {
      id: sessionId,
      tableId,
      status: "OPEN",
      openedAt: timestamp,
      closedAt: null,
      openedBy: {
        id: "30000000-0000-4000-8000-000000000001",
        displayName: "Floor Waiter",
      },
      closedBy: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function menuItem() {
  const category = {
    id: "60000000-0000-4000-8000-000000000001",
    name: "Mains",
    description: null,
    sortOrder: 0,
    isActive: true,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
  return {
    id: itemId,
    categoryId: category.id,
    name: "Paneer Bowl",
    description: "Charred paneer and rice",
    priceMinor: 10_000,
    imageUrl: null,
    isAvailable: true,
    isEffectivelyAvailable: true,
    isVegetarian: true,
    isActive: true,
    sortOrder: 0,
    category,
    modifierGroups: [
      {
        sortOrder: 0,
        group: {
          id: "70000000-0000-4000-8000-000000000001",
          name: "Protein",
          minSelections: 1,
          maxSelections: 1,
          isRequired: true,
          isActive: true,
          modifiers: [
            {
              id: modifierId,
              name: "Extra paneer",
              priceDeltaMinor: 2_500,
              isAvailable: true,
              createdAt: timestamp,
              updatedAt: timestamp,
            },
          ],
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function mockPos(page: Page) {
  let signedIn = false;
  let createdOrder: Record<string, unknown> | null = null;
  let createCount = 0;
  let rejectAsClosed = false;
  const idempotencyResults = new Map<string, Record<string, unknown>>();

  await page.route("**/api/v1/auth/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/login")) {
      signedIn = true;
      await json(route, { user: user() });
      return;
    }
    if (url.pathname.endsWith("/me") && signedIn) {
      await json(route, { user: user() });
      return;
    }
    await json(
      route,
      { error: { code: "AUTH_REQUIRED", message: "Sign in required." } },
      401,
    );
  });
  await page.route("**/api/v1/tables**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await json(route, { tables: [table()] });
  });
  await page.route("**/api/v1/menu/items**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    await json(route, {
      items: [menuItem()],
      pagination: { page: 1, limit: 100, total: 1, totalPages: 1 },
    });
  });
  await page.route("**/api/v1/orders**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const request = route.request();
    if (request.method() === "POST") {
      if (rejectAsClosed) {
        await json(
          route,
          {
            error: {
              code: "TABLE_SESSION_CLOSED",
              message: "Closed table sessions cannot accept orders.",
            },
          },
          409,
        );
        return;
      }
      const idempotencyKey = request.headers()["idempotency-key"] ?? "";
      const replay = idempotencyResults.get(idempotencyKey);
      if (replay) {
        await json(route, { order: replay }, 201);
        return;
      }
      createCount += 1;
      const input = request.postDataJSON() as {
        items: Array<{ quantity: number; specialInstructions?: string | null }>;
      };
      createdOrder = {
        id: "80000000-0000-4000-8000-000000000001",
        tableSessionId: sessionId,
        table: { id: tableId, tableNumber: "T1", displayName: "Window table" },
        orderNumber: "RF-20261119-DEMO0001",
        source: "WAITER",
        status: "PENDING",
        version: 1,
        totalMinor: 12_500 * input.items[0]!.quantity,
        createdBy: {
          id: "30000000-0000-4000-8000-000000000001",
          displayName: "Floor Waiter",
        },
        items: [
          {
            id: "90000000-0000-4000-8000-000000000001",
            menuItemId: itemId,
            itemNameSnapshot: "Paneer Bowl",
            quantity: input.items[0]!.quantity,
            unitPriceMinor: 10_000,
            lineTotalMinor: 12_500 * input.items[0]!.quantity,
            specialInstructions: input.items[0]!.specialInstructions ?? null,
            status: "PENDING",
            batchNumber: 1,
            modifiers: [
              {
                id: "a0000000-0000-4000-8000-000000000001",
                modifierGroupId: "70000000-0000-4000-8000-000000000001",
                modifierId,
                modifierGroupNameSnapshot: "Protein",
                modifierNameSnapshot: "Extra paneer",
                modifierPriceMinor: 2_500,
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
      idempotencyResults.set(idempotencyKey, createdOrder);
      await json(route, { order: createdOrder }, 201);
      return;
    }
    await json(route, {
      orders: createdOrder ? [createdOrder] : [],
      pagination: {
        page: 1,
        limit: 100,
        total: createdOrder ? 1 : 0,
        totalPages: createdOrder ? 1 : 0,
      },
    });
  });

  return {
    createCount: () => createCount,
    rejectNextAsClosed: () => {
      rejectAsClosed = true;
    },
  };
}

test("waiter submits, reloads, and safely retries a table order", async ({
  page,
}) => {
  const state = await mockPos(page);
  await page.goto("/login");
  await page.getByLabel("Work email").fill("waiter@example.com");
  await page.getByLabel("Password").fill("local-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/waiter\/pos/);

  await page.getByRole("button", { name: /Window table/ }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Extra paneer", { exact: true }).click();
  await page.getByLabel("Special instructions").fill("No onion");
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("button", { name: "Submit order" }).dblclick();
  await expect(page.getByText(/confirmed by the server/)).toBeVisible();
  expect(state.createCount()).toBe(1);
  await expect(
    page.getByText("RF-20261119-DEMO0001", { exact: true }),
  ).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: /Window table/ }).click();
  await expect(
    page.getByText("RF-20261119-DEMO0001", { exact: true }),
  ).toBeVisible();

  state.rejectNextAsClosed();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Extra paneer", { exact: true }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("button", { name: "Submit order" }).click();
  await expect(
    page.getByText("Closed table sessions cannot accept orders."),
  ).toBeVisible();
});
