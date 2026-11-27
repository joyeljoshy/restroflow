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

test("product demo loads from the keyboard and shares with the clipboard fallback", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {
        writeText: (value: string) => {
          window.localStorage.setItem("shared-video-url", value);
          return Promise.resolve();
        },
      },
    });
  });
  await page.goto("/");

  const playButton = page.getByRole("button", {
    name: /play restroflow product demonstration/i,
  });
  await playButton.focus();
  await expect(playButton).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(
    page.getByTitle("RestroFlow restaurant management product demonstration"),
  ).toHaveAttribute("src", /youtube-nocookie\.com\/embed\/uYCQo1ge99o/);

  await page.getByRole("button", { name: /share video/i }).click();
  await expect(page.getByRole("status").last()).toHaveText(
    "Video link copied to your clipboard.",
  );
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem("shared-video-url")),
    )
    .toBe("https://youtu.be/uYCQo1ge99o");
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
