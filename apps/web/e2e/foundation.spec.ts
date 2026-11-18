import { expect, test } from "@playwright/test";

test("landing page exposes the primary navigation", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: /one calm command center/i }),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: /staff sign in/i }),
  ).toBeVisible();
});

test("protected workspaces redirect anonymous staff to login", async ({
  page,
}) => {
  await page.route("**/api/v1/auth/me", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      headers: {
        "access-control-allow-origin": "http://127.0.0.1:3100",
        "access-control-allow-credentials": "true",
      },
      body: JSON.stringify({
        error: {
          code: "UNAUTHENTICATED",
          message: "A valid staff session is required.",
        },
      }),
    });
  });
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
  await expect(
    page.getByRole("heading", { name: /welcome back/i }),
  ).toBeVisible();
});
