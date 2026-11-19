"use client";

import {
  billChangedEventSchema,
  orderChangedEventSchema,
  type RealtimeChannel,
} from "@restroflow/contracts";
import { useQueryClient } from "@tanstack/react-query";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { io } from "socket.io-client";

import { useAuth } from "@/components/auth/auth-provider";
import { apiUrl } from "@/lib/auth-api";

export type RealtimeConnectionStatus =
  "offline" | "connecting" | "connected" | "reconnecting";

const RealtimeContext = createContext<RealtimeConnectionStatus>("offline");

function channelForRole(role: string): RealtimeChannel {
  if (role === "KITCHEN") return "kitchen";
  if (role === "WAITER") return "waiters";
  return "restaurant";
}

export function RealtimeProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const membership = user?.memberships[0];
  const [status, setStatus] = useState<RealtimeConnectionStatus>("offline");
  const seenEventIds = useRef(new Set<string>());
  const latestVersions = useRef(new Map<string, number>());

  useEffect(() => {
    if (!membership) {
      return;
    }

    const socket = io(apiUrl, {
      auth: { restaurantId: membership.restaurantId },
      withCredentials: true,
      transports: ["websocket", "polling"],
      reconnection: true,
    });

    const reconcile = () => {
      void queryClient.invalidateQueries({ queryKey: ["orders"] });
      void queryClient.invalidateQueries({ queryKey: ["order"] });
      void queryClient.invalidateQueries({ queryKey: ["order-history"] });
      void queryClient.invalidateQueries({ queryKey: ["kitchen-tickets"] });
    };

    socket.on("connect", () => {
      setStatus("connected");
      socket.emit("realtime:subscribe", {
        channel: channelForRole(membership.role),
      });
      reconcile();
    });
    socket.io.on("reconnect_attempt", () => setStatus("reconnecting"));
    socket.on("disconnect", (reason) => {
      setStatus(reason === "io client disconnect" ? "offline" : "reconnecting");
    });
    socket.on("connect_error", () => setStatus("reconnecting"));
    socket.on("order:changed", (input: unknown) => {
      const parsed = orderChangedEventSchema.safeParse(input);
      if (
        !parsed.success ||
        parsed.data.restaurantId !== membership.restaurantId
      )
        return;
      const event = parsed.data;
      if (seenEventIds.current.has(event.eventId)) return;
      seenEventIds.current.add(event.eventId);
      if (seenEventIds.current.size > 500) {
        const oldest = seenEventIds.current.values().next().value;
        if (oldest) seenEventIds.current.delete(oldest);
      }
      const latest = latestVersions.current.get(event.orderId) ?? 0;
      if (event.orderVersion < latest) return;
      latestVersions.current.set(event.orderId, event.orderVersion);
      reconcile();
    });
    socket.on("bill:changed", (input: unknown) => {
      const parsed = billChangedEventSchema.safeParse(input);
      if (
        !parsed.success ||
        parsed.data.restaurantId !== membership.restaurantId ||
        seenEventIds.current.has(parsed.data.eventId)
      )
        return;
      seenEventIds.current.add(parsed.data.eventId);
      void queryClient.invalidateQueries({ queryKey: ["billing-sessions"] });
      void queryClient.invalidateQueries({ queryKey: ["bill"] });
      void queryClient.invalidateQueries({ queryKey: ["bills"] });
    });

    return () => {
      socket.removeAllListeners();
      socket.io.removeAllListeners();
      socket.disconnect();
      setStatus("offline");
    };
  }, [membership, queryClient]);

  const value = useMemo(() => status, [status]);
  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRealtimeStatus() {
  return useContext(RealtimeContext);
}
