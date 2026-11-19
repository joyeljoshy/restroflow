import { expect, test, type Page, type Route } from "@playwright/test";

const restaurantId = "9010e67f-4aa1-428e-bc26-6de08366aab2";
const orderId = "80000000-0000-4000-8000-000000000001";
const itemId = "90000000-0000-4000-8000-000000000001";
const timestamp = "2026-11-19T09:00:00.000Z";
const corsHeaders = {
  "access-control-allow-origin": "http://127.0.0.1:3100",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type,x-restaurant-id",
  "access-control-allow-methods": "GET,PATCH,OPTIONS",
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

async function mockKitchen(page: Page) {
  let signedIn = false;
  const order = {
    id: orderId,
    tableSessionId: "20000000-0000-4000-8000-000000000001",
    table: {
      id: "10000000-0000-4000-8000-000000000001",
      tableNumber: "T1",
      displayName: "Window table",
    },
    orderNumber: "RF-20261119-KDS0001",
    source: "WAITER",
    status: "PENDING",
    version: 1,
    totalMinor: 12_500,
    createdBy: {
      id: "30000000-0000-4000-8000-000000000001",
      displayName: "Floor Waiter",
    },
    items: [
      {
        id: itemId,
        menuItemId: "40000000-0000-4000-8000-000000000001",
        itemNameSnapshot: "Paneer Bowl",
        quantity: 1,
        unitPriceMinor: 10_000,
        lineTotalMinor: 12_500,
        specialInstructions: "No onion",
        status: "PENDING",
        batchNumber: 1,
        modifiers: [
          {
            id: "50000000-0000-4000-8000-000000000001",
            modifierGroupId: null,
            modifierId: null,
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
  const user = {
    id: "f2bb8ad8-efb4-4d6a-a942-d31a4b432fb2",
    email: "kitchen@example.com",
    displayName: "Kitchen Staff",
    memberships: [
      {
        restaurantId,
        restaurantName: "RestroFlow Demo",
        role: "KITCHEN",
      },
    ],
  };

  await page.route("**/api/v1/auth/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith("/login")) {
      signedIn = true;
      await json(route, { user });
      return;
    }
    if (path.endsWith("/me") && signedIn) {
      await json(route, { user });
      return;
    }
    await json(
      route,
      { error: { code: "UNAUTHENTICATED", message: "Sign in required." } },
      401,
    );
  });
  await page.route("**/api/v1/kitchen/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const path = new URL(route.request().url()).pathname;
    if (route.request().method() === "GET") {
      await json(route, { orders: [order] });
      return;
    }
    const input = route.request().postDataJSON() as { status: string };
    order.version += 1;
    if (path.includes("/orders/")) {
      order.status = input.status;
      if (input.status === "PREPARING") order.items[0]!.status = "PREPARING";
    } else {
      order.items[0]!.status = input.status;
      if (input.status === "READY") order.status = "READY";
    }
    await json(route, { order });
  });
}

test("kitchen accepts, prepares, and completes a live ticket", async ({
  page,
}) => {
  await mockKitchen(page);
  await page.goto("/login");
  await page.getByLabel("Work email").fill("kitchen@example.com");
  await page.getByLabel("Password").fill("local-password");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL(/\/kitchen/);
  await expect(page.getByText("RF-20261119-KDS0001")).toBeVisible();
  await expect(page.getByText("No onion")).toBeVisible();

  await page.getByRole("button", { name: "Accept ticket" }).click();
  await page.getByRole("button", { name: "Start preparation" }).click();
  await page.getByRole("button", { name: "Mark item ready" }).click();
  await expect(page.getByText("Ready for service")).toBeVisible();
  await expect(page.getByText("READY", { exact: true })).toBeVisible();
});
