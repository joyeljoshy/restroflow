import type { Role } from "@restroflow/contracts";
import { expect, test, type Page, type Route } from "@playwright/test";

const restaurantId = "9010e67f-4aa1-428e-bc26-6de08366aab2";
const timestamp = "2026-11-19T09:00:00.000Z";
const corsHeaders = {
  "access-control-allow-origin": "http://127.0.0.1:3100",
  "access-control-allow-credentials": "true",
  "access-control-allow-headers": "content-type,x-restaurant-id",
  "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
};

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: "application/json",
    headers: corsHeaders,
    body: JSON.stringify(body),
  });
}

async function mockUser(page: Page, role: Role) {
  await page.route("**/api/v1/auth/me", (route) =>
    json(route, {
      user: {
        id: "f2bb8ad8-efb4-4d6a-a942-d31a4b432fb2",
        email: "staff@example.com",
        displayName: "Floor Staff",
        memberships: [{ restaurantId, restaurantName: "RestroFlow", role }],
      },
    }),
  );
}

function baseTable() {
  return {
    id: "10000000-0000-4000-8000-000000000001",
    tableNumber: "T1",
    displayName: "Window table",
    capacity: 4,
    isActive: true,
    occupancy: "AVAILABLE",
    activeSession: null as Record<string, unknown> | null,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

async function mockTables(page: Page, initial: ReturnType<typeof baseTable>[]) {
  const tables = initial;
  await page.route("**/api/v1/tables**", async (route) => {
    if (route.request().method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders });
      return;
    }
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const segments = url.pathname.split("/").filter(Boolean);
    const tableIndex = segments.indexOf("tables");
    const tableId = segments[tableIndex + 1];
    const table = tables.find((candidate) => candidate.id === tableId);

    if (segments.at(-1) === "qr" && method === "GET") {
      await json(route, {
        qrCode: {
          qrIdentifier: "abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
          targetUrl:
            "http://127.0.0.1:3100/menu/table/abcdefghijklmnopqrstuvwxyz1234567890ABCDEFG",
          svg: '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
          fileName: "restroflow-table-T1.svg",
        },
      });
      return;
    }
    if (segments.at(-1) === "sessions" && method === "GET") {
      await json(route, {
        sessions: table?.activeSession ? [table.activeSession] : [],
      });
      return;
    }
    if (segments.at(-1) === "sessions" && method === "POST" && table) {
      table.activeSession = {
        id: "20000000-0000-4000-8000-000000000001",
        tableId: table.id,
        status: "OPEN",
        openedAt: timestamp,
        closedAt: null,
        openedBy: {
          id: "30000000-0000-4000-8000-000000000001",
          displayName: "Floor Staff",
        },
        closedBy: null,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      table.occupancy = "OCCUPIED";
      await json(route, { session: table.activeSession }, 201);
      return;
    }
    if (
      method === "POST" &&
      url.pathname.includes("/table-sessions/") &&
      url.pathname.endsWith("/close")
    ) {
      const occupied = tables.find((candidate) => candidate.activeSession);
      const session = {
        ...occupied!.activeSession!,
        status: "CLOSED",
        closedAt: timestamp,
        closedBy: {
          id: "30000000-0000-4000-8000-000000000001",
          displayName: "Floor Staff",
        },
      };
      occupied!.activeSession = null;
      occupied!.occupancy = "AVAILABLE";
      await json(route, { session });
      return;
    }
    if (method === "POST") {
      const input = request.postDataJSON() as Record<string, unknown>;
      const created = { ...baseTable(), ...input };
      tables.push(created);
      await json(route, { table: created }, 201);
      return;
    }
    if (method === "PATCH" && table) {
      Object.assign(table, request.postDataJSON());
      table.occupancy = table.isActive ? "AVAILABLE" : "OUT_OF_SERVICE";
      await json(route, { table });
      return;
    }
    await json(route, { tables });
  });
  await page.route("**/api/v1/table-sessions/**", async (route) => {
    const occupied = tables.find((candidate) => candidate.activeSession);
    const session = {
      ...occupied!.activeSession!,
      status: "CLOSED",
      closedAt: timestamp,
      closedBy: {
        id: "30000000-0000-4000-8000-000000000001",
        displayName: "Floor Staff",
      },
    };
    occupied!.activeSession = null;
    occupied!.occupancy = "AVAILABLE";
    await json(route, { session });
  });
}

test("admin creates, updates, and displays a table QR code", async ({
  page,
}) => {
  await mockUser(page, "ADMIN");
  await mockTables(page, []);
  await page.goto("/admin/tables");
  await page.getByRole("button", { name: "Add table" }).click();
  await page.getByLabel("Table number").fill("T1");
  await page.getByLabel("Display name").fill("Window table");
  await page.getByLabel("Seating capacity").fill("4");
  await page.getByRole("button", { name: "Create table" }).click();
  await expect(page.getByText("Window table")).toBeVisible();
  await page.getByRole("button", { name: "Edit" }).click();
  await page.getByLabel("Display name").fill("Patio table");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Patio table")).toBeVisible();
  await page.getByRole("button", { name: "QR code" }).click();
  await expect(page.getByAltText("QR code for Patio table")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Download SVG" }),
  ).toBeVisible();
});

test("waiter opens and closes a table session", async ({ page }) => {
  await mockUser(page, "WAITER");
  await mockTables(page, [baseTable()]);
  await page.goto("/waiter/tables");
  await page.getByRole("button", { name: "Open session" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  const tableGrid = page.getByRole("region", { name: "Restaurant tables" });
  await expect(tableGrid.getByText("Occupied")).toBeVisible();
  await page.getByRole("button", { name: "Close session" }).click();
  await page.getByRole("button", { name: "Confirm" }).click();
  await expect(tableGrid.getByText("Available")).toBeVisible();
});

test("manager cannot modify table configuration", async ({ page }) => {
  await mockUser(page, "MANAGER");
  await mockTables(page, [baseTable()]);
  await page.goto("/admin/tables");
  await expect(
    page.getByRole("heading", { name: "Table management" }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Add table" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Edit" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "QR code" })).toHaveCount(0);
});
