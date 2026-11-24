import { describe, expect, it } from "vitest";

import manifest from "./manifest";
import robots from "./robots";
import sitemap from "./sitemap";

describe("public metadata routes", () => {
  it("publishes only the landing page in the sitemap", () => {
    expect(sitemap()).toEqual([
      expect.objectContaining({
        url: "https://restroflow-joyel.vercel.app",
      }),
    ]);
  });

  it("keeps private and identifier-based routes out of crawler access", () => {
    const rules = robots().rules;
    const publicRule = Array.isArray(rules) ? rules[0] : rules;

    expect(publicRule?.disallow).toEqual(
      expect.arrayContaining([
        "/login",
        "/admin",
        "/kitchen",
        "/waiter",
        "/cashier",
        "/unauthorized",
        "/menu/table",
      ]),
    );
  });

  it("declares installable app icons without offline behavior", () => {
    const appManifest = manifest();

    expect(appManifest.icons).toEqual([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512" }),
    ]);
    expect(appManifest).not.toHaveProperty("serviceworker");
  });
});
