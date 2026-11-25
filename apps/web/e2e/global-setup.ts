import { createServer } from "node:http";

import next from "next";

export default async function globalSetup() {
  const hostname = "127.0.0.1";
  const port = 3100;
  process.env.CUSTOMER_WEB_ORIGIN ??= `http://${hostname}:${port}`;
  if (process.env.REAL_CUSTOMER_E2E === "1") {
    const { requireLoopbackApiUrl, localCustomerProxySecret } =
      await import("./isolated-live-api");
    process.env.CUSTOMER_API_ORIGIN = requireLoopbackApiUrl(
      process.env.REAL_CUSTOMER_API_URL ?? "http://localhost:4000",
    ).origin;
    process.env.CUSTOMER_PROXY_SECRET = localCustomerProxySecret;
  }
  const app = next({ dev: false, dir: process.cwd(), hostname, port });
  const handle = app.getRequestHandler();

  await app.prepare();

  const server = createServer((request, response) => {
    void handle(request, response);
  });
  await new Promise<void>((resolve) => server.listen(port, hostname, resolve));

  return async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  };
}
