import type { Role, StaffMember } from "@restroflow/contracts";
import { expect, test, type Page, type Route } from "@playwright/test";

const restaurantId = "9010e67f-4aa1-428e-bc26-6de08366aab2";
const corsHeaders = {
  "access-control-allow-origin": "http://127.0.0.1:3100",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type",
  "access-control-allow-methods": "GET,POST,PATCH,OPTIONS",
};

async function fulfillJson(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

async function mockAdmin(page: Page) {
  await page.route("**/api/v1/auth/me", (route) =>
    fulfillJson(route, {
      user: {
        id: "f2bb8ad8-efb4-4d6a-a942-d31a4b432fb2",
        email: "admin@example.com",
        displayName: "Primary Admin",
        memberships: [
          {
            restaurantId,
            restaurantName: "RestroFlow Demo",
            role: "ADMIN",
          },
        ],
      },
    }),
  );
}

test("admin updates restaurant settings", async ({ page }) => {
  await mockAdmin(page);
  const restaurant = {
    id: restaurantId,
    name: "RestroFlow Demo",
    slug: "restroflow-demo",
    address: null,
    phone: null,
    email: null,
    timezone: "Asia/Kolkata",
    currency: "INR",
    taxName: "GST",
    taxRateBasisPoints: 0,
    pricesIncludeTax: false,
    createdAt: "2026-11-18T10:00:00.000Z",
    updatedAt: "2026-11-18T10:00:00.000Z",
  };

  await page.route(`**/api/v1/restaurants/${restaurantId}`, async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    if (route.request().method() === "PATCH") {
      Object.assign(restaurant, route.request().postDataJSON());
    }
    await fulfillJson(route, { restaurant });
  });

  await page.goto("/admin/settings");
  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await page.getByLabel("Restaurant name").fill("Cafe Aurora");
  await page.getByLabel("Tax rate (%)").fill("18");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Settings saved")).toBeVisible();
  await expect(page.getByLabel("Restaurant name")).toHaveValue("Cafe Aurora");
});

test("admin searches and creates a staff account", async ({ page }) => {
  await mockAdmin(page);
  const staff: StaffMember[] = [
    {
      id: "97a2cbe2-5761-4b1d-8e30-3c4f5b4e766e",
      displayName: "Primary Admin",
      email: "admin@example.com",
      role: "ADMIN",
      isActive: true,
      createdAt: "2026-11-18T10:00:00.000Z",
      updatedAt: "2026-11-18T10:00:00.000Z",
    },
  ];

  await page.route(
    `**/api/v1/restaurants/${restaurantId}/staff**`,
    async (route) => {
      const method = route.request().method();
      if (method === "OPTIONS") {
        await route.fulfill({ status: 204, headers: corsHeaders });
        return;
      }
      if (method === "POST") {
        const input = route.request().postDataJSON() as {
          displayName: string;
          email: string;
          role: Role;
        };
        const created = {
          id: "20000000-0000-4000-8000-000000000001",
          displayName: input.displayName,
          email: input.email,
          role: input.role,
          isActive: true,
          createdAt: "2026-11-18T10:00:00.000Z",
          updatedAt: "2026-11-18T10:00:00.000Z",
        };
        staff.push(created);
        await fulfillJson(route, { staffMember: created }, 201);
        return;
      }
      const url = new URL(route.request().url());
      const search = url.searchParams.get("search")?.toLowerCase();
      const filtered = search
        ? staff.filter((member) =>
            `${member.displayName} ${member.email}`
              .toLowerCase()
              .includes(search),
          )
        : staff;
      await fulfillJson(route, { staff: filtered, total: filtered.length });
    },
  );

  await page.goto("/admin/staff");
  await expect(
    page.getByRole("heading", { name: "Staff management" }),
  ).toBeVisible();
  await expect(page.getByText("Primary Admin").first()).toBeVisible();
  await page.getByRole("button", { name: "Add staff" }).click();
  await page.getByLabel("Full name").fill("Priya Shah");
  await page.getByLabel("Work email").fill("priya@example.com");
  await page
    .getByLabel("Temporary password")
    .fill("correct-horse-battery-staple");
  await page
    .getByRole("dialog", { name: "Add staff member" })
    .locator('select[name="role"]')
    .selectOption("WAITER");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Priya Shah").first()).toBeVisible();
  await page.getByLabel("Search staff").fill("priya");
  await expect(
    page.getByRole("row", { name: /Primary Admin/ }),
  ).not.toBeVisible();
  await expect(page.getByText("Priya Shah").first()).toBeVisible();
});
