import type { Server as HttpServer } from "node:http";

import {
  realtimeSubscriptionSchema,
  type OrderChangedEvent,
  type RealtimeChannel,
  type Role,
} from "@restroflow/contracts";
import { Server, type Socket } from "socket.io";

import { readSessionTokenFromCookieHeader } from "../auth/auth.cookies.js";
import type { AuthServiceContract, AuthSession } from "../auth/auth.service.js";
import {
  createOrderChangedEvent,
  type RealtimePublisher,
} from "./realtime.publisher.js";

type ClientEvents = {
  "realtime:subscribe": (
    input: unknown,
    acknowledge?: (result: { ok: boolean; error?: string }) => void,
  ) => void;
};

type ServerEvents = {
  "order:changed": (event: OrderChangedEvent) => void;
};

type SocketData = {
  restaurantId: string;
  membershipId: string;
  role: Role;
  sessionToken: string;
};

export type RealtimeServer = Server<
  ClientEvents,
  ServerEvents,
  Record<string, never>,
  SocketData
>;

const allowedChannels: Readonly<Record<RealtimeChannel, readonly Role[]>> = {
  restaurant: ["ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"],
  kitchen: ["ADMIN", "MANAGER", "KITCHEN"],
  waiters: ["ADMIN", "MANAGER", "WAITER"],
};

function room(restaurantId: string, channel: RealtimeChannel) {
  return `restaurant:${restaurantId}:${channel}`;
}

function selectedMembership(socket: Socket, session: AuthSession) {
  const auth = socket.handshake.auth as unknown;
  const requested =
    typeof auth === "object" && auth !== null && "restaurantId" in auth
      ? auth.restaurantId
      : undefined;
  const memberships = session.user.memberships;
  return typeof requested === "string"
    ? memberships.find((membership) => membership.restaurantId === requested)
    : memberships.length === 1
      ? memberships[0]
      : undefined;
}

export function createRealtimeServer(
  server: HttpServer,
  options: {
    allowedOrigins: string[];
    authService: AuthServiceContract;
    revalidateIntervalMs?: number;
  },
): RealtimeServer {
  const io: RealtimeServer = new Server(server, {
    cors: { origin: options.allowedOrigins, credentials: true },
    transports: ["websocket", "polling"],
  });

  io.use((socket, next) => {
    void (async () => {
      try {
        const sessionToken = readSessionTokenFromCookieHeader(
          socket.request.headers.cookie,
        );
        const session = await options.authService.authenticate(sessionToken);
        const membership = selectedMembership(socket, session);
        if (!sessionToken || !membership) {
          next(new Error("RESTAURANT_ACCESS_DENIED"));
          return;
        }
        socket.data = {
          restaurantId: membership.restaurantId,
          membershipId: session.membershipIds[membership.restaurantId]!,
          role: membership.role,
          sessionToken,
        };
        next();
      } catch {
        next(new Error("UNAUTHENTICATED"));
      }
    })();
  });

  io.on("connection", (socket) => {
    const revalidate = async () => {
      try {
        const session = await options.authService.authenticate(
          socket.data.sessionToken,
        );
        const membership = session.user.memberships.find(
          (candidate) => candidate.restaurantId === socket.data.restaurantId,
        );
        if (
          !membership ||
          membership.role !== socket.data.role ||
          session.membershipIds[membership.restaurantId] !==
            socket.data.membershipId
        )
          socket.disconnect(true);
      } catch {
        socket.disconnect(true);
      }
    };

    socket.on("realtime:subscribe", async (input, acknowledge) => {
      const parsed = realtimeSubscriptionSchema.safeParse(input);
      if (!parsed.success) {
        acknowledge?.({ ok: false, error: "INVALID_SUBSCRIPTION" });
        return;
      }
      await revalidate();
      if (!socket.connected) return;
      if (!allowedChannels[parsed.data.channel].includes(socket.data.role)) {
        acknowledge?.({ ok: false, error: "ROOM_FORBIDDEN" });
        return;
      }
      await socket.join(room(socket.data.restaurantId, parsed.data.channel));
      acknowledge?.({ ok: true });
    });

    const timer = setInterval(
      () => void revalidate(),
      options.revalidateIntervalMs ?? 30_000,
    );
    timer.unref();
    socket.on("disconnect", () => clearInterval(timer));
  });

  return io;
}

export class SocketIoRealtimePublisher implements RealtimePublisher {
  private io: RealtimeServer | undefined;
  private authService: AuthServiceContract | undefined;

  attach(io: RealtimeServer, authService: AuthServiceContract) {
    this.io = io;
    this.authService = authService;
  }

  async orderChanged(
    input: Parameters<RealtimePublisher["orderChanged"]>[0],
  ): Promise<void> {
    if (!this.io || !this.authService) return;
    const rooms = ["restaurant", "kitchen", "waiters"].map((channel) =>
      room(input.restaurantId, channel as RealtimeChannel),
    );
    const connected = new Map(
      (
        await Promise.all(
          rooms.map((roomName) => this.io!.in(roomName).fetchSockets()),
        )
      )
        .flat()
        .map((socket) => [socket.id, socket]),
    );
    await Promise.all(
      [...connected.values()].map(async (socket) => {
        try {
          const session = await this.authService!.authenticate(
            socket.data.sessionToken,
          );
          const membership = session.user.memberships.find(
            (candidate) => candidate.restaurantId === input.restaurantId,
          );
          if (
            !membership ||
            membership.role !== socket.data.role ||
            session.membershipIds[input.restaurantId] !==
              socket.data.membershipId
          )
            socket.disconnect(true);
        } catch {
          socket.disconnect(true);
        }
      }),
    );
    const event = createOrderChangedEvent(input);
    this.io.to(rooms).emit("order:changed", event);
  }
}
