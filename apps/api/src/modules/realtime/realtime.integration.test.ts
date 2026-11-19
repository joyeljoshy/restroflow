import { createServer, type Server as HttpServer } from "node:http";

import type { AuthenticatedUser, Role } from "@restroflow/contracts";
import {
  io as createClient,
  type Socket as ClientSocket,
} from "socket.io-client";
import { afterEach, describe, expect, it } from "vitest";

import type { AuthServiceContract, AuthSession } from "../auth/auth.service.js";
import {
  createRealtimeServer,
  type RealtimeServer,
  SocketIoRealtimePublisher,
} from "./realtime.server.js";

const restaurantOne = "10000000-0000-4000-8000-000000000001";
const restaurantTwo = "10000000-0000-4000-8000-000000000002";
const membershipOne = "20000000-0000-4000-8000-000000000001";
const membershipTwo = "20000000-0000-4000-8000-000000000002";
const orderId = "30000000-0000-4000-8000-000000000001";

let server: HttpServer | undefined;
let realtime: RealtimeServer | undefined;
const clients: ClientSocket[] = [];

afterEach(async () => {
  for (const client of clients.splice(0)) client.disconnect();
  if (realtime)
    await new Promise<void>((resolve, reject) => {
      void realtime!.close((error) => (error ? reject(error) : resolve()));
    });
  if (server?.listening)
    await new Promise<void>((resolve) => server!.close(() => resolve()));
  realtime = undefined;
  server = undefined;
});

function user(restaurantId: string, role: Role): AuthenticatedUser {
  return {
    id: "40000000-0000-4000-8000-000000000001",
    email: "socket@example.test",
    displayName: "Socket Staff",
    memberships: [{ restaurantId, restaurantName: "Socket Test", role }],
  };
}

async function setup() {
  let revoked = false;
  const authService: AuthServiceContract = {
    login: () => Promise.reject(new Error("unused")),
    logout: () => Promise.resolve(),
    authenticate: (token): Promise<AuthSession> => {
      if (!token || revoked)
        return Promise.reject(new Error("UNAUTHENTICATED"));
      if (token === "kitchen-one")
        return Promise.resolve({
          user: user(restaurantOne, "KITCHEN"),
          sessionTokenHash: "hash-one",
          membershipIds: { [restaurantOne]: membershipOne },
        });
      if (token === "waiter-one")
        return Promise.resolve({
          user: user(restaurantOne, "WAITER"),
          sessionTokenHash: "hash-waiter",
          membershipIds: { [restaurantOne]: membershipOne },
        });
      if (token === "kitchen-two")
        return Promise.resolve({
          user: user(restaurantTwo, "KITCHEN"),
          sessionTokenHash: "hash-two",
          membershipIds: { [restaurantTwo]: membershipTwo },
        });
      return Promise.reject(new Error("UNAUTHENTICATED"));
    },
  };
  server = createServer();
  realtime = createRealtimeServer(server, {
    allowedOrigins: ["http://localhost:3000"],
    authService,
    revalidateIntervalMs: 20,
  });
  await new Promise<void>((resolve) => server!.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  return {
    url: `http://127.0.0.1:${address.port}`,
    revoke: () => {
      revoked = true;
    },
  };
}

function client(url: string, token: string | undefined, restaurantId: string) {
  const socket = createClient(url, {
    auth: { restaurantId },
    extraHeaders: token
      ? {
          cookie: `restroflow_session=${token}`,
          origin: "http://localhost:3000",
        }
      : { origin: "http://localhost:3000" },
    forceNew: true,
    reconnection: false,
  });
  clients.push(socket);
  return socket;
}

function connected(socket: ClientSocket) {
  return new Promise<void>((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
}

function subscribe(socket: ClientSocket, channel: string) {
  return new Promise<{ ok: boolean; error?: string }>((resolve) =>
    socket.emit("realtime:subscribe", { channel }, resolve),
  );
}

describe("authenticated Socket.IO rooms", () => {
  it("rejects missing sessions and unauthorized kitchen subscriptions", async () => {
    const context = await setup();
    const missing = client(context.url, undefined, restaurantOne);
    const error = await new Promise<Error>((resolve) =>
      missing.once("connect_error", resolve),
    );
    expect(error.message).toBe("UNAUTHENTICATED");

    const waiter = client(context.url, "waiter-one", restaurantOne);
    await connected(waiter);
    await expect(subscribe(waiter, "kitchen")).resolves.toEqual({
      ok: false,
      error: "ROOM_FORBIDDEN",
    });
  });

  it("delivers invalidations only to authorized restaurant rooms", async () => {
    const context = await setup();
    const first = client(context.url, "kitchen-one", restaurantOne);
    const second = client(context.url, "kitchen-two", restaurantTwo);
    await Promise.all([connected(first), connected(second)]);
    await Promise.all([
      subscribe(first, "kitchen"),
      subscribe(second, "kitchen"),
    ]);

    const received = new Promise<unknown>((resolve) =>
      first.once("order:changed", resolve),
    );
    let crossRestaurantReceived = false;
    second.once("order:changed", () => {
      crossRestaurantReceived = true;
    });
    const publisher = new SocketIoRealtimePublisher();
    publisher.attach(realtime!, {
      login: () => Promise.reject(new Error("unused")),
      logout: () => Promise.resolve(),
      authenticate: (token) => {
        if (token !== "kitchen-one")
          return Promise.reject(new Error("UNAUTHENTICATED"));
        return Promise.resolve({
          user: user(restaurantOne, "KITCHEN"),
          sessionTokenHash: "hash-one",
          membershipIds: { [restaurantOne]: membershipOne },
        });
      },
    });
    await publisher.orderChanged({
      restaurantId: restaurantOne,
      orderId,
      orderVersion: 2,
      changeType: "STATUS_UPDATED",
    });

    await expect(received).resolves.toMatchObject({
      restaurantId: restaurantOne,
      orderId,
      orderVersion: 2,
    });
    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(crossRestaurantReceived).toBe(false);
  });

  it("disconnects a socket after its session is revoked", async () => {
    const context = await setup();
    const socket = client(context.url, "kitchen-one", restaurantOne);
    await connected(socket);
    await subscribe(socket, "kitchen");
    const disconnected = new Promise<void>((resolve) =>
      socket.once("disconnect", () => resolve()),
    );
    context.revoke();
    await expect(disconnected).resolves.toBeUndefined();
  });
});
