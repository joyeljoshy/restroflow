import { expect, test, type Page, type Route } from "@playwright/test";

const identifier = "customer-table-identifier-00000000000000000001";
const itemId = "10000000-0000-4000-8000-000000000001";
const categoryId = "20000000-0000-4000-8000-000000000001";
const groupId = "30000000-0000-4000-8000-000000000001";
const modifierId = "40000000-0000-4000-8000-000000000001";
const orderId = "50000000-0000-4000-8000-000000000001";
const timestamp = "2026-11-19T10:00:00.000Z";
const corsHeaders = {
  "access-control-allow-origin": "http://127.0.0.1:3100",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type,idempotency-key",
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

function menu() {
  return {
    context: {
      restaurant: { name: "Emerald Kitchen", currency: "INR" },
      table: { displayName: "Garden table", tableNumber: "G4" },
      hasActiveSession: true,
    },
    categories: [
      {
        id: categoryId,
        name: "Mains",
        description: "From our kitchen",
        sortOrder: 0,
      },
    ],
    items: [
      {
        id: itemId,
        categoryId,
        name: "Paneer Bowl",
        description: "Charred paneer with fragrant rice",
        priceMinor: 10_000,
        imageUrl: null,
        isVegetarian: true,
        sortOrder: 0,
        modifierGroups: [
          {
            sortOrder: 0,
            group: {
              id: groupId,
              name: "Spice",
              minSelections: 1,
              maxSelections: 1,
              isRequired: true,
              modifiers: [
                { id: modifierId, name: "Medium", priceDeltaMinor: 500 },
              ],
            },
          },
        ],
      },
    ],
  };
}

function order() {
  return {
    id: orderId,
    tableSessionId: "60000000-0000-4000-8000-000000000001",
    table: {
      id: "70000000-0000-4000-8000-000000000001",
      tableNumber: "G4",
      displayName: "Garden table",
    },
    orderNumber: "RF-20261119-GUEST01",
    source: "CUSTOMER",
    status: "PENDING",
    version: 1,
    totalMinor: 10_500,
    items: [
      {
        id: "80000000-0000-4000-8000-000000000001",
        menuItemId: itemId,
        itemNameSnapshot: "Paneer Bowl",
        quantity: 1,
        unitPriceMinor: 10_000,
        lineTotalMinor: 10_500,
        specialInstructions: null,
        status: "PENDING",
        batchNumber: 1,
        modifiers: [
          {
            id: "90000000-0000-4000-8000-000000000001",
            modifierGroupId: groupId,
            modifierId,
            modifierGroupNameSnapshot: "Spice",
            modifierNameSnapshot: "Medium",
            modifierPriceMinor: 500,
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
}

async function mockCustomerApi(page: Page, failFirstSubmission = false) {
  let activated = false;
  let created = false;
  let failed = false;
  const keys: string[] = [];
  await page.route("**/api/v1/auth/me", (route) =>
    json(
      route,
      {
        error: { code: "UNAUTHENTICATED", message: "Staff sign-in required." },
      },
      401,
    ),
  );
  await page.route("**/api/v1/public/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path.endsWith(`/tables/${identifier}/menu`)) {
      await json(route, menu());
      return;
    }
    if (path.endsWith(`/tables/${identifier}`)) {
      await json(route, { context: menu().context });
      return;
    }
    if (path.endsWith("/customer-session") && request.method() === "GET") {
      if (activated)
        await json(route, {
          session: {
            id: "a0000000-0000-4000-8000-000000000001",
            restaurantName: "Emerald Kitchen",
            tableDisplayName: "Garden table",
            expiresAt: "2026-11-19T14:00:00.000Z",
          },
        });
      else
        await json(
          route,
          {
            error: {
              code: "CUSTOMER_SESSION_INVALID",
              message: "Activation required.",
            },
          },
          401,
        );
      return;
    }
    if (path.endsWith("/table-access/activate")) {
      const input = request.postDataJSON() as { activationCode: string };
      if (input.activationCode !== "123456") {
        await json(
          route,
          { error: { code: "ACTIVATION_INVALID", message: "Invalid code." } },
          401,
        );
        return;
      }
      activated = true;
      await json(
        route,
        {
          session: {
            id: "a0000000-0000-4000-8000-000000000001",
            restaurantName: "Emerald Kitchen",
            tableDisplayName: "Garden table",
            expiresAt: "2026-11-19T14:00:00.000Z",
          },
        },
        201,
      );
      return;
    }
    if (path.endsWith("/orders") && request.method() === "POST") {
      keys.push(request.headers()["idempotency-key"] ?? "");
      if (failFirstSubmission && !failed) {
        failed = true;
        await json(
          route,
          {
            error: {
              code: "TEMPORARY",
              message: "Connection interrupted; retry safely.",
            },
          },
          503,
        );
        return;
      }
      created = true;
      await json(route, { order: order() }, 201);
      return;
    }
    if (path.endsWith("/orders") && request.method() === "GET") {
      await json(route, { orders: created ? [order()] : [] });
      return;
    }
    if (path.includes("/orders/")) {
      await json(
        route,
        { error: { code: "ORDER_NOT_FOUND", message: "Order not found." } },
        404,
      );
      return;
    }
    await json(
      route,
      { error: { code: "NOT_FOUND", message: "Not found." } },
      404,
    );
  });
  return { keys };
}

test("customer page notices when staff opens the table session", async ({
  page,
}) => {
  let hasActiveSession = false;
  await page.route("**/api/v1/auth/me", (route) =>
    json(
      route,
      {
        error: { code: "UNAUTHENTICATED", message: "Staff sign-in required." },
      },
      401,
    ),
  );
  await page.route("**/api/v1/public/**", async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const path = new URL(request.url()).pathname;
    const context = { ...menu().context, hasActiveSession };
    if (path.endsWith(`/tables/${identifier}/menu`)) {
      await json(route, { ...menu(), context });
      return;
    }
    if (path.endsWith(`/tables/${identifier}`)) {
      await json(route, { context });
      return;
    }
    if (path.endsWith("/customer-session")) {
      await json(
        route,
        {
          error: {
            code: "CUSTOMER_SESSION_INVALID",
            message: "Activation required.",
          },
        },
        401,
      );
      return;
    }
    await json(
      route,
      { error: { code: "NOT_FOUND", message: "Not found." } },
      404,
    );
  });

  await page.goto(`/menu/table/${identifier}`);
  await expect(
    page.getByText(/ordering opens after staff starts your table session/i),
  ).toBeVisible();

  hasActiveSession = true;
  await expect(
    page.getByText(/ordering is open\. ask staff for your activation code/i),
  ).toBeVisible({ timeout: 10_000 });
});

async function addItemAndActivate(page: Page) {
  await page.goto(`/menu/table/${identifier}`);
  await expect(
    page.getByRole("heading", { name: "Emerald Kitchen" }),
  ).toBeVisible();
  await page.getByPlaceholder("Search the menu").fill("Paneer");
  await page.getByRole("button", { name: "Customize & add" }).click();
  await page.getByText("Medium", { exact: true }).click();
  await page.getByRole("button", { name: "Add to cart" }).click();
  await page.getByRole("button", { name: /View cart/ }).click();
  await page.getByRole("button", { name: "Activate & submit" }).click();
  await page.getByLabel("6-digit activation code").fill("123456");
  await page.getByRole("button", { name: "Activate ordering" }).click();
  await page.getByRole("button", { name: /View cart/ }).click();
}

test("customer browses, activates, submits, and reloads order tracking", async ({
  page,
}) => {
  await mockCustomerApi(page);
  await addItemAndActivate(page);
  await page.getByRole("button", { name: "Submit order" }).click();
  await expect(
    page.getByRole("heading", { name: "Order confirmed" }),
  ).toBeVisible();
  await expect(
    page.getByText("RF-20261119-GUEST01", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Track order" }).click();
  await expect(page.getByText("Sent to the restaurant")).toBeVisible();
  await page.reload();
  await expect(
    page
      .getByRole("region", { name: "Your orders" })
      .getByText(/RF-20261119-GUEST01/),
  ).toBeVisible();
});

test("customer safely retries an interrupted submission with the same key", async ({
  page,
}) => {
  const state = await mockCustomerApi(page, true);
  await addItemAndActivate(page);
  await page.getByRole("button", { name: "Submit order" }).click();
  await expect(
    page.getByText("Connection interrupted; retry safely."),
  ).toBeVisible();
  await page.getByRole("button", { name: "Submit order" }).click();
  await expect(
    page.getByRole("heading", { name: "Order confirmed" }),
  ).toBeVisible();
  expect(state.keys).toHaveLength(2);
  expect(state.keys[1]).toBe(state.keys[0]);
});
