import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: "html",
  use: { baseURL: "http://127.0.0.1:3100", trace: "on-first-retry" },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    ...(process.env.CUSTOMER_WEBKIT_E2E === "1"
      ? [
          {
            name: "customer-webkit",
            testMatch: /customer-ordering.*\.spec\.ts$/,
            use: { ...devices["iPhone 13"] },
          },
        ]
      : []),
  ],
});
