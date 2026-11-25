import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { proxyCustomerRequest } from "./customer-proxy";

const frontend = "https://customer.example";
const backend = "https://backend.example";
const token = "A".repeat(43);
const customerCookie = `restroflow_customer_session=${token}`;
const secret = "a".repeat(64);

function send(path: string, init?: RequestInit) {
  const headers = new Headers(init?.headers);
  if (!headers.has("x-forwarded-for"))
    headers.set("x-forwarded-for", "192.0.2.10");
  return proxyCustomerRequest(
    new Request(`${frontend}/api/customer/${path}`, { ...init, headers }),
    path.split("/"),
  );
}

describe("customer proxy", () => {
  const upstream = vi.fn<typeof fetch>();
  beforeEach(() => {
    upstream.mockReset();
    vi.stubGlobal("fetch", upstream);
    vi.stubEnv("VERCEL", "1");
    vi.stubEnv("CUSTOMER_WEB_ORIGIN", frontend);
    vi.stubEnv("CUSTOMER_API_ORIGIN", backend);
    vi.stubEnv("CUSTOMER_PROXY_SECRET", secret);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([undefined, "invalid"])(
    "fails explicitly with missing or malformed Vercel credentials",
    async (value) => {
      vi.stubEnv("CUSTOMER_PROXY_SECRET", value);
      expect((await send("customer-session")).status).toBe(503);
      expect(upstream).not.toHaveBeenCalled();
    },
  );

  it("authenticates proxied reads and rejects malformed platform IPs", async () => {
    expect(
      (
        await send("customer-session", {
          headers: { "x-forwarded-for": "192.0.2.10, 192.0.2.11" },
        })
      ).status,
    ).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
    upstream.mockResolvedValueOnce(Response.json({ session: {} }));
    const response = await send("customer-session", {
      headers: {
        "x-customer-proxy-secret": "ignored",
        "x-customer-client-ip": "192.0.2.11",
      },
    });
    expect(response.status).toBe(200);
    expect(
      Object.fromEntries(new Headers(upstream.mock.calls[0]?.[1]?.headers)),
    ).toEqual({
      "x-customer-proxy-secret": secret,
      "x-customer-client-ip": "192.0.2.10",
    });
  });

  it("rejects unsupported routes, methods and missing or wrong write origins", async () => {
    expect((await send("auth/login", { method: "POST" })).status).toBe(404);
    expect((await send("orders", { method: "DELETE" })).status).toBe(404);
    expect((await send("orders", { method: "POST" })).status).toBe(403);
    expect(
      (
        await send("orders", {
          method: "POST",
          headers: { origin: "https://other.example" },
        })
      ).status,
    ).toBe(403);
    expect(upstream).not.toHaveBeenCalled();
  });

  it("allowlists headers and preserves the order body, idempotency key and response metadata", async () => {
    upstream.mockResolvedValue(
      Response.json(
        { error: { code: "RATE_LIMITED", message: "Try again." } },
        {
          status: 429,
          headers: { "retry-after": "5", "x-request-id": "request-1" },
        },
      ),
    );
    const response = await send("orders", {
      method: "POST",
      body: "{}",
      headers: {
        origin: frontend,
        "content-type": "application/json",
        "idempotency-key": "order-key",
        "x-forwarded-for": "192.0.2.10",
        "x-customer-client-ip": "192.0.2.11",
        "x-customer-proxy-secret": "client-controlled",
        authorization: "ignored",
        cookie: `staff=private; restroflow_session=staff-secret; ${customerCookie}`,
      },
    });
    const [url, init] = upstream.mock.calls[0]!;
    expect(url).toEqual(new URL(`${backend}/api/v1/public/orders`));
    expect(Object.fromEntries(new Headers(init?.headers))).toEqual({
      origin: frontend,
      "content-type": "application/json",
      "idempotency-key": "order-key",
      "x-customer-client-ip": "192.0.2.10",
      "x-customer-proxy-secret": secret,
      cookie: customerCookie,
    });
    expect(await (init?.body as Blob).text()).toBe("{}");
    expect(init).toMatchObject({ redirect: "manual", cache: "no-store" });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("5");
    expect(response.headers.get("x-request-id")).toBe("request-1");
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("relays only the expected cookie with first-party attributes and rewrites deletion", async () => {
    const headers = new Headers();
    headers.append("set-cookie", "restroflow_session=staff; Path=/");
    headers.append(
      "set-cookie",
      `${customerCookie}; Domain=backend.example; Path=/; HttpOnly; Secure; SameSite=None; Max-Age=14400`,
    );
    upstream.mockResolvedValueOnce(
      Response.json({ session: {} }, { status: 201, headers }),
    );
    const init = {
      method: "POST",
      headers: {
        origin: frontend,
        "x-forwarded-for": "192.0.2.10",
        cookie: customerCookie,
      },
    };
    const activated = await send("table-access/activate", init);
    expect(activated.headers.getSetCookie()).toEqual([
      `${customerCookie}; Path=/api/customer; HttpOnly; SameSite=Lax; Secure; Max-Age=14400`,
    ]);
    expect(
      new Headers(upstream.mock.calls[0]?.[1]?.headers).has("cookie"),
    ).toBe(false);
    const deletion =
      "restroflow_customer_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT";
    upstream.mockResolvedValueOnce(
      new Response(null, { status: 204, headers: { "set-cookie": deletion } }),
    );
    const logout = await send("customer-session/logout", init);
    expect(logout.headers.get("set-cookie")).toBe(
      "restroflow_customer_session=; Path=/api/customer; HttpOnly; SameSite=Lax; Secure; Expires=Thu, 01 Jan 1970 00:00:00 GMT",
    );
    upstream.mockResolvedValueOnce(
      Response.json(
        { error: {} },
        { status: 401, headers: { "set-cookie": deletion } },
      ),
    );
    expect((await send("customer-session")).headers.has("set-cookie")).toBe(
      false,
    );
    upstream.mockResolvedValueOnce(
      Response.json(
        { error: {} },
        { status: 401, headers: { "set-cookie": deletion } },
      ),
    );
    expect(
      (
        await send("customer-session", { headers: { cookie: customerCookie } })
      ).headers.get("set-cookie"),
    ).toBe(logout.headers.get("set-cookie"));
  });

  it("rejects an invalid configured upstream and contains upstream redirects", async () => {
    vi.stubEnv("CUSTOMER_API_ORIGIN", "http://other.example");
    expect((await send("orders")).status).toBe(503);
    expect(upstream).not.toHaveBeenCalled();
    vi.stubEnv("CUSTOMER_API_ORIGIN", backend);
    upstream.mockResolvedValue(Response.redirect("https://other.example"));
    const response = await send("orders");
    expect(response.status).toBe(502);
    expect(response.headers.has("location")).toBe(false);
  });
});
