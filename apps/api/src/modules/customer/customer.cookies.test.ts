import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";

import { setCustomerSessionCookie } from "./customer.cookies.js";

describe("customer session cookies", () => {
  it("supports the secure cross-site production attributes", async () => {
    const app = express();
    app.get("/cookie", (_req, res) => {
      setCustomerSessionCookie(res, "customer-token", {
        secure: true,
        sameSite: "none",
        maxAgeMs: 60_000,
      });
      res.sendStatus(204);
    });

    const response = await request(app).get("/cookie").expect(204);
    expect(response.headers["set-cookie"]?.[0]).toContain("HttpOnly");
    expect(response.headers["set-cookie"]?.[0]).toContain("Secure");
    expect(response.headers["set-cookie"]?.[0]).toContain("SameSite=None");
  });
});
