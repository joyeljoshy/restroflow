"use client";

import type {
  Order,
  OrderItemStatus,
  OrderStatus,
} from "@restroflow/contracts";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  BellOff,
  Check,
  ChefHat,
  Clock3,
  LoaderCircle,
  RefreshCw,
  Utensils,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";

import { useAuth } from "@/components/auth/auth-provider";
import { useRealtimeStatus } from "@/components/realtime/realtime-provider";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ApiError } from "@/lib/auth-api";
import {
  fetchKitchenTickets,
  updateKitchenItemStatus,
  updateKitchenOrderStatus,
} from "@/lib/order-api";
import { cn } from "@/lib/utils";

function ageText(createdAt: string, now = Date.now()) {
  const minutes = Math.max(
    0,
    Math.floor((now - new Date(createdAt).getTime()) / 60_000),
  );
  return minutes < 60
    ? `${minutes}m`
    : `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const OrderAge = memo(function OrderAge({ createdAt }: { createdAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(timer);
  }, []);
  return <span>{ageText(createdAt, now)}</span>;
});

function itemStatusClass(status: OrderItemStatus) {
  if (status === "READY") return "bg-emerald-100 text-emerald-900";
  if (status === "PREPARING") return "bg-amber-100 text-amber-950";
  if (status === "CANCELLED") return "bg-stone-200 text-stone-700";
  return "bg-sky-100 text-sky-900";
}

type TicketActions = {
  busy: boolean;
  setOrderStatus: (order: Order, status: OrderStatus) => void;
  setItemStatus: (
    order: Order,
    itemId: string,
    status: OrderItemStatus,
  ) => void;
};

export function KitchenTicketCard({
  order,
  actions,
}: {
  order: Order;
  actions?: TicketActions;
}) {
  const canComplete =
    order.status === "PREPARING" &&
    order.items.some((item) => item.status === "PREPARING") &&
    order.items
      .filter((item) => item.status !== "CANCELLED")
      .every((item) => item.status === "PREPARING" || item.status === "READY");

  return (
    <Card
      className={cn(
        "overflow-hidden border-2",
        order.status === "PENDING" && "border-sky-500",
        order.status === "READY" && "border-emerald-500",
      )}
    >
      <div className="flex items-start justify-between gap-3 border-b bg-stone-50 p-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black">{order.orderNumber}</h3>
            {order.status === "PENDING" && (
              <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-black text-white">
                NEW
              </span>
            )}
          </div>
          <p className="mt-1 font-bold text-stone-700">
            {order.table.displayName} · Table {order.table.tableNumber}
          </p>
        </div>
        <div className="text-right text-sm font-bold">
          <span className="inline-flex items-center gap-1 text-stone-700">
            <Clock3 className="size-4" />
            <OrderAge createdAt={order.createdAt} />
          </span>
          <p className="mt-1 text-xs text-stone-500">{order.source}</p>
        </div>
      </div>

      <div className="space-y-3 p-4">
        {order.items.map((item) => (
          <div
            key={item.id}
            className={cn(
              "rounded-xl border p-3",
              item.status === "CANCELLED" && "opacity-60",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-base font-black">
                  {item.quantity} × {item.itemNameSnapshot}
                </p>
                <p className="mt-0.5 text-xs font-bold text-stone-500">
                  Batch {item.batchNumber}
                </p>
              </div>
              <span
                className={cn(
                  "rounded-full px-2 py-1 text-[11px] font-black",
                  itemStatusClass(item.status),
                )}
              >
                {item.status}
              </span>
            </div>
            {item.modifiers.length > 0 && (
              <p className="mt-2 text-sm text-stone-700">
                +{" "}
                {item.modifiers
                  .map((entry) => entry.modifierNameSnapshot)
                  .join(", ")}
              </p>
            )}
            {item.specialInstructions && (
              <p className="mt-2 rounded-lg bg-amber-50 p-2 text-sm font-bold text-amber-950">
                Note: {item.specialInstructions}
              </p>
            )}
            {actions &&
              (item.status === "PENDING" || item.status === "PREPARING") &&
              order.status !== "PENDING" && (
                <Button
                  className="mt-3 min-h-11 w-full"
                  variant={item.status === "PENDING" ? "outline" : "default"}
                  disabled={actions.busy}
                  onClick={() =>
                    actions.setItemStatus(
                      order,
                      item.id,
                      item.status === "PENDING" ? "PREPARING" : "READY",
                    )
                  }
                >
                  {item.status === "PENDING" ? (
                    <ChefHat className="size-4" />
                  ) : (
                    <Check className="size-4" />
                  )}
                  {item.status === "PENDING" ? "Start item" : "Mark item ready"}
                </Button>
              )}
          </div>
        ))}
      </div>

      {actions && (
        <div className="flex flex-wrap gap-2 border-t bg-stone-50 p-4">
          {order.status === "PENDING" && (
            <>
              <Button
                className="min-h-11 flex-1"
                disabled={actions.busy}
                onClick={() => actions.setOrderStatus(order, "ACCEPTED")}
              >
                Accept ticket
              </Button>
              <Button
                className="min-h-11"
                variant="outline"
                disabled={actions.busy}
                onClick={() => actions.setOrderStatus(order, "REJECTED")}
              >
                <X className="size-4" /> Reject
              </Button>
            </>
          )}
          {order.status === "ACCEPTED" && (
            <Button
              className="min-h-11 w-full"
              disabled={actions.busy}
              onClick={() => actions.setOrderStatus(order, "PREPARING")}
            >
              <ChefHat className="size-4" /> Start preparation
            </Button>
          )}
          {canComplete && (
            <Button
              className="min-h-11 w-full"
              disabled={actions.busy}
              onClick={() => actions.setOrderStatus(order, "READY")}
            >
              <Check className="size-4" /> Mark all ready
            </Button>
          )}
          {order.status === "READY" && (
            <p className="w-full text-center text-sm font-black text-emerald-800">
              Ready for service
            </p>
          )}
        </div>
      )}
    </Card>
  );
}

export function KitchenDisplay() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const realtimeStatus = useRealtimeStatus();
  const membership = user?.memberships.find((candidate) =>
    ["ADMIN", "MANAGER", "KITCHEN"].includes(candidate.role),
  );
  const restaurantId = membership?.restaurantId;
  const [notice, setNotice] = useState<string | null>(null);
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const previousPending = useRef<number | null>(null);
  const audioContext = useRef<AudioContext | null>(null);

  const tickets = useQuery({
    queryKey: ["kitchen-tickets", restaurantId],
    queryFn: () => fetchKitchenTickets(restaurantId!),
    enabled: Boolean(restaurantId),
    refetchInterval: 30_000,
  });

  const refresh = async () => {
    await queryClient.invalidateQueries({
      queryKey: ["kitchen-tickets", restaurantId],
    });
  };
  const orderMutation = useMutation({
    mutationFn: ({ order, status }: { order: Order; status: OrderStatus }) =>
      updateKitchenOrderStatus(restaurantId!, order.id, {
        version: order.version,
        status,
        reason: `Kitchen moved order to ${status}`,
      }),
    onSuccess: async (order) => {
      setNotice(`${order.orderNumber} is now ${order.status.toLowerCase()}.`);
      await refresh();
    },
    onError: async () => refresh(),
  });
  const itemMutation = useMutation({
    mutationFn: ({
      order,
      itemId,
      status,
    }: {
      order: Order;
      itemId: string;
      status: OrderItemStatus;
    }) =>
      updateKitchenItemStatus(restaurantId!, itemId, {
        version: order.version,
        status,
      }),
    onSuccess: async () => refresh(),
    onError: async () => refresh(),
  });

  const pendingCount =
    tickets.data?.filter((order) => order.status === "PENDING").length ?? 0;
  useEffect(() => {
    if (
      alertsEnabled &&
      previousPending.current !== null &&
      pendingCount > previousPending.current
    ) {
      const context = audioContext.current;
      if (!context) return;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.connect(gain);
      gain.connect(context.destination);
      gain.gain.value = 0.08;
      oscillator.frequency.value = 660;
      oscillator.start();
      oscillator.stop(context.currentTime + 0.12);
    }
    previousPending.current = pendingCount;
  }, [alertsEnabled, pendingCount]);

  useEffect(
    () => () => {
      if (audioContext.current) void audioContext.current.close();
    },
    [],
  );

  const toggleAlerts = () => {
    if (alertsEnabled) {
      if (audioContext.current) void audioContext.current.close();
      audioContext.current = null;
      setAlertsEnabled(false);
      return;
    }
    const context = new AudioContext();
    audioContext.current = context;
    void context.resume();
    setAlertsEnabled(true);
  };

  const columns = [
    {
      title: "New",
      statuses: ["PENDING", "ACCEPTED"] as OrderStatus[],
      tone: "border-sky-500",
    },
    {
      title: "Preparing",
      statuses: ["PREPARING"] as OrderStatus[],
      tone: "border-amber-500",
    },
    {
      title: "Ready",
      statuses: ["READY"] as OrderStatus[],
      tone: "border-emerald-500",
    },
  ];
  const error = orderMutation.error ?? itemMutation.error;
  const actions: TicketActions = {
    busy: orderMutation.isPending || itemMutation.isPending,
    setOrderStatus: (order, status) => orderMutation.mutate({ order, status }),
    setItemStatus: (order, itemId, status) =>
      itemMutation.mutate({ order, itemId, status }),
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-black tracking-widest text-emerald-700 uppercase">
            Kitchen display
          </p>
          <h1 className="mt-1 text-3xl font-black tracking-tight">
            Live order board
          </h1>
          <p className="mt-2 text-sm text-stone-600">
            Oldest tickets appear first. Item snapshots stay fixed after
            ordering.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <span
            className={cn(
              "inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 text-sm font-bold",
              realtimeStatus === "connected"
                ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                : "border-amber-300 bg-amber-50 text-amber-900",
            )}
          >
            {realtimeStatus === "connected" ? (
              <Wifi className="size-4" />
            ) : (
              <WifiOff className="size-4" />
            )}
            {realtimeStatus === "connected" ? "Live" : "Reconnecting"}
          </span>
          <Button variant="outline" onClick={toggleAlerts}>
            {alertsEnabled ? (
              <Bell className="size-4" />
            ) : (
              <BellOff className="size-4" />
            )}
            {alertsEnabled ? "Alerts on" : "Enable alerts"}
          </Button>
          <Button variant="outline" onClick={() => void tickets.refetch()}>
            <RefreshCw
              className={cn("size-4", tickets.isFetching && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </header>

      {notice && (
        <div
          className="rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-900"
          role="status"
        >
          {notice}
        </div>
      )}
      {error && (
        <div
          className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-900"
          role="alert"
        >
          {error instanceof ApiError
            ? error.message
            : "The kitchen update failed. The board has been refreshed."}
        </div>
      )}

      {tickets.isPending ? (
        <div
          className="grid gap-4 lg:grid-cols-3"
          aria-label="Loading kitchen tickets"
        >
          {[0, 1, 2].map((key) => (
            <Card key={key} className="h-64 animate-pulse bg-stone-100" />
          ))}
        </div>
      ) : tickets.isError ? (
        <Card className="p-8 text-center" role="alert">
          <WifiOff className="mx-auto size-8 text-red-700" />
          <h2 className="mt-3 text-lg font-black">
            Kitchen tickets unavailable
          </h2>
          <Button className="mt-4" onClick={() => void tickets.refetch()}>
            Try again
          </Button>
        </Card>
      ) : (
        <div className="grid items-start gap-5 lg:grid-cols-3">
          {columns.map((column) => {
            const orders = (tickets.data ?? []).filter((order) =>
              column.statuses.includes(order.status),
            );
            return (
              <section
                key={column.title}
                aria-labelledby={`column-${column.title}`}
              >
                <div
                  className={cn(
                    "mb-3 flex items-center justify-between border-t-4 pt-3",
                    column.tone,
                  )}
                >
                  <h2
                    id={`column-${column.title}`}
                    className="flex items-center gap-2 text-xl font-black"
                  >
                    {column.title === "Preparing" ? (
                      <ChefHat className="size-5" />
                    ) : (
                      <Utensils className="size-5" />
                    )}
                    {column.title}
                  </h2>
                  <span className="rounded-full bg-stone-900 px-2.5 py-1 text-xs font-black text-white">
                    {orders.length}
                  </span>
                </div>
                <div className="space-y-4">
                  {orders.length === 0 ? (
                    <Card className="border-dashed p-8 text-center text-sm text-stone-500">
                      No {column.title.toLowerCase()} tickets
                    </Card>
                  ) : (
                    orders.map((order) => (
                      <KitchenTicketCard
                        key={order.id}
                        order={order}
                        actions={actions}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}
      {(orderMutation.isPending || itemMutation.isPending) && (
        <p
          className="fixed right-5 bottom-5 inline-flex items-center gap-2 rounded-full bg-stone-950 px-4 py-2 text-sm font-bold text-white shadow-lg"
          role="status"
        >
          <LoaderCircle className="size-4 animate-spin" /> Saving kitchen update
        </p>
      )}
    </div>
  );
}
