import type { BrowserContext } from "@playwright/test";

export const localCustomerProxySecret = "a".repeat(64);

export function requireLoopbackApiUrl(value: string): URL {
  const url = URL.parse(value);
  if (
    !url ||
    !["http:", "https:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "[::1]"].includes(url.hostname) ||
    url.username ||
    url.password
  )
    throw new Error(
      "Live E2E requires a loopback API URL without credentials.",
    );
  return url;
}

export async function restrictLiveApiRequests(
  context: BrowserContext,
  origin: string,
) {
  await context.route("**/api/v1/**", (route) =>
    new URL(route.request().url()).origin === origin
      ? route.continue()
      : route.abort(),
  );
}
