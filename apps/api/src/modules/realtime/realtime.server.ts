import type { Server as HttpServer } from "node:http";

import {
  type BillChangedEvent,
  realtimeSubscriptionSchema,
  customerOrderChangedEventSchema,
  type CustomerOrderChangedEvent,
  type OrderChangedEvent,
  type RealtimeChannel,
  type Role,
} from "@restroflow/contracts";
import { Server, type Socket } from "socket.io";

import { readSessionTokenFromCookieHeader } from "../auth/auth.cookies.js";
import type { AuthServiceContract, AuthSession } from "../auth/auth.service.js";
import { readCustomerSessionTokenFromCookieHeader } from "../customer/customer.cookies.js";
import type { CustomerServiceContract } from "../customer/customer.service.js";
import {
  createBillChangedEvent,
  createOrderChangedEvent,
  type RealtimePublisher,
} from "./realtime.publisher.js";

type ClientEvents = {
  "realtime:subscribe": (
    input: unknown,
    acknowledge?: (result: { ok: boolean; error?: string }) => void,
  ) => void;
  "customer:subscribe": (
    input: unknown,
    acknowledge?: (result: { ok: boolean; error?: string }) => void,
  ) => void;
};

type ServerEvents = {
  "bill:changed": (event: BillChangedEvent) => void;
  "order:changed": (event: OrderChangedEvent) => void;
  "customer:order-changed": (event: CustomerOrderChangedEvent) => void;
};

type StaffSocketData = {
  audience: "staff";
  restaurantId: string;
  membershipId: string;
  role: Role;
  sessionToken: string;
};

type CustomerSocketData = {
  audience: "customer";
  restaurantId: string;
  customerSessionId: string;
  sessionToken: string;
};

type SocketData = StaffSocketData | CustomerSocketData;

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

function customerRoom(customerSessionId: string) {
  return `customer-session:${customerSessionId}`;
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
    customerService?: CustomerServiceContract;
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
        const handshakeAuth = socket.handshake.auth as unknown;
        const customerAudience =
          typeof handshakeAuth === "object" &&
          handshakeAuth !== null &&
          "audience" in handshakeAuth &&
          handshakeAuth.audience === "customer";
        if (customerAudience) {
          if (!options.customerService) throw new Error("UNAUTHENTICATED");
          const sessionToken = readCustomerSessionTokenFromCookieHeader(
            socket.request.headers.cookie,
          );
          const session =
            await options.customerService.authenticate(sessionToken);
          if (!sessionToken) throw new Error("UNAUTHENTICATED");
          socket.data = {
            audience: "customer",
            restaurantId: session.restaurantId,
            customerSessionId: session.id,
            sessionToken,
          };
          next();
          return;
        }
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
          audience: "staff",
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
        if (socket.data.audience === "customer") {
          if (!options.customerService) throw new Error("UNAUTHENTICATED");
          const session = await options.customerService.authenticate(
            socket.data.sessionToken,
          );
          if (
            session.id !== socket.data.customerSessionId ||
            session.restaurantId !== socket.data.restaurantId
          )
            socket.disconnect(true);
          return;
        }
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
      if (socket.data.audience !== "staff") {
        acknowledge?.({ ok: false, error: "ROOM_FORBIDDEN" });
        return;
      }
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

    socket.on("customer:subscribe", async (input, acknowledge) => {
      if (socket.data.audience !== "customer" || !options.customerService) {
        acknowledge?.({ ok: false, error: "ROOM_FORBIDDEN" });
        return;
      }
      const parsed = customerOrderChangedEventSchema
        .pick({ orderId: true })
        .safeParse(input);
      if (!parsed.success) {
        acknowledge?.({ ok: false, error: "INVALID_SUBSCRIPTION" });
        return;
      }
      await revalidate();
      if (!socket.connected || socket.data.audience !== "customer") return;
      try {
        const session = await options.customerService.authenticate(
          socket.data.sessionToken,
        );
        await options.customerService.getOrder(session, parsed.data.orderId);
        await socket.join(customerRoom(session.id));
        acknowledge?.({ ok: true });
      } catch {
        acknowledge?.({ ok: false, error: "ORDER_FORBIDDEN" });
      }
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
  private customerService: CustomerServiceContract | undefined;

  attach(
    io: RealtimeServer,
    authService: AuthServiceContract,
    customerService?: CustomerServiceContract,
  ) {
    this.io = io;
    this.authService = authService;
    this.customerService = customerService;
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
        if (socket.data.audience !== "staff") return;
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
    if (input.customerOrderingSessionId && this.customerService) {
      const target = customerRoom(input.customerOrderingSessionId);
      const customerSockets = await this.io.in(target).fetchSockets();
      await Promise.all(
        customerSockets.map(async (socket) => {
          if (socket.data.audience !== "customer") return;
          try {
            const session = await this.customerService!.authenticate(
              socket.data.sessionToken,
            );
            if (session.id !== input.customerOrderingSessionId)
              socket.disconnect(true);
          } catch {
            socket.disconnect(true);
          }
        }),
      );
      const parsed = customerOrderChangedEventSchema.parse({
        eventId: event.eventId,
        schemaVersion: 1,
        orderId: event.orderId,
        changeType: event.changeType,
        orderVersion: event.orderVersion,
        occurredAt: event.occurredAt,
      });
      this.io.to(target).emit("customer:order-changed", parsed);
    }
  }

  async billChanged(input: {
    restaurantId: string;
    billId: string;
    tableSessionId: string;
    billVersion: number;
    changeType: BillChangedEvent["changeType"];
  }): Promise<void> {
    if (!this.io || !this.authService) return;
    const sockets = await this.io
      .in(room(input.restaurantId, "restaurant"))
      .fetchSockets();
    const event = createBillChangedEvent(input);
    await Promise.all(
      sockets.map(async (socket) => {
        if (
          socket.data.audience !== "staff" ||
          !["ADMIN", "MANAGER", "CASHIER"].includes(socket.data.role)
        )
          return;
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
          ) {
            socket.disconnect(true);
            return;
          }
          socket.emit("bill:changed", event);
        } catch {
          socket.disconnect(true);
        }
      }),
    );
  }
}
