import type { Role } from "@restroflow/contracts";
import { expect, test, type Page, type Route } from "@playwright/test";

const restaurantId = "9010e67f-4aa1-428e-bc26-6de08366aab2";
const corsHeaders = {
  "access-control-allow-origin": "http://127.0.0.1:3100",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type,x-restaurant-id",
  "access-control-allow-methods": "GET,OPTIONS",
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
    email: "analytics@example.com",
    displayName: "Analytics Admin",
    memberships: [{ restaurantId, restaurantName: "RestroFlow Demo", role }],
  };
}

async function mockAnalytics(page: Page, role: Role = "ADMIN") {
  await page.route("**/api/v1/**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const url = new URL(route.request().url());
    if (url.pathname === "/api/v1/auth/me") {
      await json(route, { user: user(role) });
      return;
    }
    if (!url.pathname.startsWith("/api/v1/analytics/")) {
      await json(
        route,
        { error: { code: "NOT_FOUND", message: "Not found." } },
        404,
      );
      return;
    }
    const empty = url.searchParams.get("startDate") === "2030-01-01";
    const context = {
      startDate: url.searchParams.get("startDate"),
      endDate: url.searchParams.get("endDate"),
      granularity: url.searchParams.get("granularity"),
      timezone: "Asia/Kolkata",
      currency: "INR",
      endExclusive: true,
    };
    const path = url.pathname.split("/").at(-1);
    if (path === "overview") {
      await json(route, {
        overview: {
          context,
          finalizedSales: {
            value: empty ? "0" : "30000",
            previousValue: "20000",
            changePercent: empty ? null : 50,
          },
          recordedPayments: {
            value: empty ? "0" : "20000",
            previousValue: "10000",
            changePercent: empty ? null : 100,
          },
          currentOutstandingMinor: empty ? "0" : "10000",
          periodOutstandingMinor: empty ? "0" : "10000",
          finalizedBillCount: {
            value: empty ? 0 : 2,
            previousValue: 1,
            changePercent: empty ? null : 100,
          },
          completedOrderCount: {
            value: empty ? 0 : 3,
            previousValue: 2,
            changePercent: empty ? null : 50,
          },
          averageBillValueMinor: empty ? "0" : "15000",
          activeTableSessions: empty ? 0 : 2,
          activeKitchenOrders: empty ? 0 : 1,
        },
      });
      return;
    }
    if (path === "sales") {
      await json(route, {
        sales: {
          context,
          points: empty
            ? []
            : [{ period: "2026-11-20", amountMinor: "30000", count: 2 }],
        },
      });
      return;
    }
    if (path === "payments") {
      await json(route, {
        payments: {
          context,
          totalRecordedMinor: empty ? "0" : "20000",
          methods: empty
            ? []
            : [{ method: "UPI", amountMinor: "20000", paymentCount: 1 }],
          points: empty
            ? []
            : [{ period: "2026-11-20", amountMinor: "20000", count: 1 }],
          partiallyPaidBillCount: empty ? 0 : 1,
          currentOutstandingMinor: empty ? "0" : "10000",
          periodOutstandingMinor: empty ? "0" : "10000",
        },
      });
      return;
    }
    if (path === "popular-items") {
      await json(route, {
        popularItems: {
          context,
          items: empty
            ? []
            : [
                {
                  menuItemId: "10000000-0000-4000-8000-000000000001",
                  itemName: "Masala dosa",
                  quantitySold: 4,
                  salesContributionMinor: "12000",
                  popularityPercent: 80,
                },
              ],
        },
      });
      return;
    }
    if (path === "orders") {
      await json(route, {
        orders: {
          context,
          ordersCreated: empty ? 0 : 4,
          ordersServed: empty ? 0 : 3,
          ordersCancelled: empty ? 0 : 1,
          ordersRejected: 0,
          sourceBreakdown: { waiter: empty ? 0 : 3, customer: empty ? 0 : 1 },
          peakOrderingHour: empty ? null : 20,
          points: empty ? [] : [{ period: "2026-11-20", created: 4 }],
        },
      });
      return;
    }
    if (path === "tables") {
      await json(route, {
        tables: {
          context,
          activeTables: 8,
          currentlyOccupiedTables: empty ? 0 : 2,
          availableTables: empty ? 8 : 6,
          completedSessions: empty ? 0 : 3,
          averageOccupiedDurationMinutes: empty ? null : 72,
          usage: [],
        },
      });
      return;
    }
    await json(route, {
      kitchen: {
        context,
        activePreparingOrders: empty ? 0 : 1,
        readyForServingOrders: 0,
        averageQueueToPreparingMinutes: empty ? null : 4,
        averagePreparationMinutes: empty ? null : 12,
        averageTotalToReadyMinutes: empty ? null : 16,
        completedItemSamples: empty ? 0 : 3,
      },
    });
  });
}

test("admin analytics overview loads persisted metric labels and charts", async ({
  page,
}) => {
  await mockAnalytics(page);
  await page.goto("/admin/analytics");
  await expect(
    page.getByRole("heading", { name: "Analytics dashboard" }),
  ).toBeVisible();
  for (const label of [
    "Finalized sales",
    "Recorded payments",
    "Current outstanding",
    "Finalized bills",
    "Completed orders",
    "Average bill value",
    "Active table sessions",
    "Active kitchen orders",
  ]) {
    await expect(page.getByText(label, { exact: true })).toBeVisible();
  }
  await expect(page.getByText("Finalized sales trend")).toBeVisible();
  await expect(page.getByText("Masala dosa")).toBeVisible();
});

test("date and granularity filters update every analytics query", async ({
  page,
}) => {
  await mockAnalytics(page);
  await page.goto("/admin/analytics");
  await expect(
    page.getByText("Finalized sales", { exact: true }),
  ).toBeVisible();
  await page.getByLabel("Start date").fill("2026-11-01");
  await page.getByLabel("End date (exclusive)").fill("2026-12-01");
  const requestPromise = page.waitForRequest((request) => {
    const url = new URL(request.url());
    return (
      url.pathname === "/api/v1/analytics/overview" &&
      url.searchParams.get("granularity") === "week"
    );
  });
  await page.getByLabel("Group by").selectOption("week");
  const request = await requestPromise;
  const url = new URL(request.url());
  expect(url.searchParams.get("startDate")).toBe("2026-11-01");
  expect(url.searchParams.get("endDate")).toBe("2026-12-01");
});

test("financial cards keep sales, payments, and outstanding distinct", async ({
  page,
}) => {
  await mockAnalytics(page);
  await page.goto("/admin/analytics");
  await expect(
    page.getByText("₹300.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("₹200.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(
    page.getByText("₹100.00", { exact: true }).first(),
  ).toBeVisible();
  await expect(page.getByText("UPI (manual)")).toBeVisible();
});

test("unauthorized staff cannot enter analytics", async ({ page }) => {
  await mockAnalytics(page, "WAITER");
  await page.goto("/admin/analytics");
  await expect(page).toHaveURL(/\/unauthorized$/);
});

test("an empty period shows informative states", async ({ page }) => {
  await mockAnalytics(page);
  await page.goto("/admin/analytics");
  await page.getByLabel("Start date").fill("2030-01-01");
  await page.getByLabel("End date (exclusive)").fill("2030-01-02");
  await expect(page.getByText("No finalized bills")).toBeVisible();
  await expect(page.getByText("No recorded payments").first()).toBeVisible();
  await expect(page.getByText("No submitted orders")).toBeVisible();
  await expect(page.getByText("No billed items")).toBeVisible();
});
