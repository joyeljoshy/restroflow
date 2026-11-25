import { isIP } from "node:net";

const cookieName = "restroflow_customer_session";
const prefix = "/api/customer";
const routes = [
  ["GET", /^tables\/[A-Za-z0-9_-]{32,64}(?:\/menu)?$/],
  ["POST", /^table-access\/activate$/],
  ["GET", /^customer-session$/],
  ["POST", /^customer-session\/logout$/],
  ["GET", /^orders(?:\/[\da-f-]{36})?$/i],
  ["POST", /^orders$/],
] as const;

function failure(status: number, code: string, message: string) {
  return Response.json(
    { error: { code, message } },
    {
      status,
      headers: { "cache-control": "private, no-store" },
    },
  );
}

function configuredOrigin(value: string | undefined, local: boolean) {
  if (!value) throw new Error("Missing customer proxy origin");
  const url = new URL(value);
  if (
    value !== url.origin ||
    (url.protocol !== "https:" &&
      !(
        local &&
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
      ))
  )
    throw new Error("Invalid customer proxy origin");
  return url;
}

export async function proxyCustomerRequest(
  request: Request,
  segments: string[],
) {
  const path = segments.join("/");
  if (
    segments.some((segment) => !/^[\w-]+$/.test(segment)) ||
    !routes.some(
      ([method, pattern]) => method === request.method && pattern.test(path),
    )
  )
    return failure(404, "NOT_FOUND", "Customer endpoint not found.");

  const vercel = process.env.VERCEL === "1";
  let backend: URL;
  let frontend: URL;
  const secret = process.env.CUSTOMER_PROXY_SECRET;
  try {
    backend = configuredOrigin(
      process.env.CUSTOMER_API_ORIGIN ??
        (!vercel ? "http://localhost:4000" : undefined),
      !vercel,
    );
    frontend = configuredOrigin(
      process.env.CUSTOMER_WEB_ORIGIN ??
        (!vercel ? "http://localhost:3000" : undefined),
      !vercel,
    );
    if (
      (vercel || secret !== undefined) &&
      !/^[0-9a-f]{64}$/.test(secret ?? "")
    )
      throw new Error("Invalid customer proxy secret");
  } catch {
    return failure(
      503,
      "CUSTOMER_API_UNAVAILABLE",
      "Customer ordering is temporarily unavailable.",
    );
  }

  const headers = new Headers();
  if (request.method === "POST") {
    if (request.headers.get("origin") !== frontend.origin)
      return failure(
        403,
        "ORIGIN_FORBIDDEN",
        "This request origin is not allowed.",
      );
    headers.set("origin", frontend.origin);
  }
  for (const name of ["content-type", "idempotency-key"]) {
    const value = request.headers.get(name);
    if (value !== null) headers.set(name, value);
  }
  const cookie = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => new RegExp(`^${cookieName}=[A-Za-z0-9_-]{43}$`).test(part));
  if (cookie && !path.startsWith("tables/") && path !== "table-access/activate")
    headers.set("cookie", cookie);
  if (secret) {
    const clientIp = vercel
      ? request.headers.get("x-forwarded-for")
      : "127.0.0.1";
    if (!clientIp || !isIP(clientIp))
      return failure(
        503,
        "CUSTOMER_API_UNAVAILABLE",
        "Customer ordering is temporarily unavailable.",
      );
    headers.set("x-customer-proxy-secret", secret);
    headers.set("x-customer-client-ip", clientIp);
  }

  try {
    if (Number(request.headers.get("content-length")) > 1_048_576)
      return failure(
        413,
        "PAYLOAD_TOO_LARGE",
        "The request body exceeds the allowed size.",
      );
    const chunks: Uint8Array<ArrayBuffer>[] = [];
    let size = 0;
    if (request.body && request.method === "POST") {
      const reader = request.body.getReader();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 1_048_576) {
          void reader.cancel().catch(() => undefined);
          return failure(
            413,
            "PAYLOAD_TOO_LARGE",
            "The request body exceeds the allowed size.",
          );
        }
        chunks.push(new Uint8Array(value));
      }
    }
    const upstream = await fetch(new URL(`/api/v1/public/${path}`, backend), {
      method: request.method,
      headers,
      body: chunks.length ? new Blob(chunks) : undefined,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.any([request.signal, AbortSignal.timeout(75_000)]),
    });
    const contentType = upstream.headers.get("content-type");
    if (
      upstream.status !== 204 &&
      !(
        contentType?.startsWith("application/json") ||
        (upstream.status === 429 && contentType?.startsWith("text/plain"))
      )
    ) {
      await upstream.body?.cancel();
      if (upstream.status === 429) {
        const response = failure(
          429,
          "RATE_LIMITED",
          "Too many requests. Try again later.",
        );
        const retryAfter = upstream.headers.get("retry-after");
        if (retryAfter) response.headers.set("retry-after", retryAfter);
        return response;
      }
      return failure(
        502,
        "CUSTOMER_API_UNAVAILABLE",
        "Customer ordering is temporarily unavailable.",
      );
    }
    if (upstream.status >= 300 && upstream.status < 400) {
      await upstream.body?.cancel();
      return failure(
        502,
        "CUSTOMER_API_UNAVAILABLE",
        "Customer ordering is temporarily unavailable.",
      );
    }
    const responseHeaders = new Headers({
      "cache-control": "private, no-store",
    });
    for (const name of [
      "content-type",
      "retry-after",
      "ratelimit",
      "ratelimit-policy",
      "x-request-id",
    ]) {
      const value = upstream.headers.get(name);
      if (value !== null) responseHeaders.set(name, value);
    }
    for (const rawCookie of upstream.headers.getSetCookie()) {
      const [pair, ...attributes] = rawCookie
        .split(";")
        .map((part) => part.trim());
      if (!pair) continue;
      const issue =
        path === "table-access/activate" &&
        upstream.status === 201 &&
        new RegExp(`^${cookieName}=[A-Za-z0-9_-]{43}$`).test(pair);
      const clear =
        ((path === "customer-session/logout" && upstream.status === 204) ||
          (upstream.status === 401 && Boolean(cookie))) &&
        pair === `${cookieName}=`;
      if (!issue && !clear) continue;
      const lifetime = attributes.filter((attribute) =>
        /^(?:Max-Age|Expires)=/i.test(attribute),
      );
      responseHeaders.set(
        "set-cookie",
        [
          pair,
          `Path=${prefix}`,
          "HttpOnly",
          "SameSite=Lax",
          ...(frontend.protocol === "https:" ? ["Secure"] : []),
          ...lifetime,
        ].join("; "),
      );
      break;
    }
    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch {
    return failure(
      502,
      "CUSTOMER_API_UNAVAILABLE",
      "Customer ordering is temporarily unavailable.",
    );
  }
}
