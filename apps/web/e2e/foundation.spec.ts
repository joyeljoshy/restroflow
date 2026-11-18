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
