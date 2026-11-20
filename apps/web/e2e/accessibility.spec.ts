import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route } from "@playwright/test";

const identifier = "a11y-table-identifier-0000000000000000000001";
const corsHeaders = {
  "access-control-allow-origin": "http://127.0.0.1:3100",
  "access-control-allow-credentials": "true",
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

async function expectNoSeriousViolations(page: Page) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(
    result.violations.filter(({ impact }) =>
      impact ? ["serious", "critical"].includes(impact) : false,
    ),
  ).toEqual([]);
}

test("login has no serious automated accessibility violations", async ({
  page,
}) => {
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Welcome back" }),
  ).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("authenticated admin shell has no serious automated accessibility violations", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", (route) =>
    json(route, {
      user: {
        id: "10000000-0000-4000-8000-000000000001",
        email: "admin@example.test",
        displayName: "Accessibility Admin",
        memberships: [
          {
            restaurantId: "20000000-0000-4000-8000-000000000001",
            restaurantName: "Accessible Restaurant",
            role: "ADMIN",
          },
        ],
      },
    }),
  );
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Restaurant command center" }),
  ).toBeVisible();
  await expectNoSeriousViolations(page);
});

test("public customer menu has no serious automated accessibility violations", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", (route) =>
    json(route, { error: { code: "UNAUTHENTICATED" } }, 401),
  );
  await page.route("**/api/v1/public/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.endsWith(`/tables/${identifier}/menu`)) {
      await json(route, {
        context: {
          restaurant: { name: "Accessible Kitchen", currency: "INR" },
          table: { displayName: "Garden table", tableNumber: "G4" },
          hasActiveSession: true,
        },
        categories: [
          {
            id: "30000000-0000-4000-8000-000000000001",
            name: "Mains",
            description: "Freshly prepared",
            sortOrder: 0,
          },
        ],
        items: [
          {
            id: "40000000-0000-4000-8000-000000000001",
            categoryId: "30000000-0000-4000-8000-000000000001",
            name: "Vegetable bowl",
            description: "Rice and seasonal vegetables",
            priceMinor: 10_000,
            imageUrl: null,
            isVegetarian: true,
            sortOrder: 0,
            modifierGroups: [],
          },
        ],
      });
      return;
    }
    if (path.endsWith(`/tables/${identifier}`)) {
      await json(route, {
        context: {
          restaurant: { name: "Accessible Kitchen", currency: "INR" },
          table: { displayName: "Garden table", tableNumber: "G4" },
          hasActiveSession: true,
        },
      });
      return;
    }
    if (path.endsWith("/customer-session")) {
      await json(route, { error: { code: "CUSTOMER_SESSION_INVALID" } }, 401);
      return;
    }
    if (path.endsWith("/orders")) {
      await json(route, { orders: [] });
      return;
    }
    await route.abort();
  });

  await page.goto(`/menu/table/${identifier}`);
  await expect(
    page.getByRole("heading", { name: "Accessible Kitchen" }),
  ).toBeVisible();
  await expectNoSeriousViolations(page);

  await page.getByRole("button", { name: "Customize & add" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(
    dialog.getByRole("button", { name: "Add to cart" }),
  ).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(
    dialog.getByRole("button", { name: "Close dialog" }),
  ).toBeFocused();
});
