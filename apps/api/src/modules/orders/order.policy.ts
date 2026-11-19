import type { OrderItemStatus, OrderStatus, Role } from "@restroflow/contracts";

export const orderTransitions: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["SERVED", "CANCELLED"],
  SERVED: [],
  CANCELLED: [],
  REJECTED: [],
};

export const itemTransitions: Readonly<
  Record<OrderItemStatus, readonly OrderItemStatus[]>
> = {
  PENDING: ["PREPARING", "CANCELLED"],
  PREPARING: ["READY", "CANCELLED"],
  READY: ["CANCELLED"],
  SERVED: [],
  CANCELLED: [],
};

const roleStatusTargets: Readonly<Record<Role, readonly OrderStatus[]>> = {
  ADMIN: ["ACCEPTED", "PREPARING", "READY", "SERVED", "CANCELLED", "REJECTED"],
  MANAGER: [
    "ACCEPTED",
    "PREPARING",
    "READY",
    "SERVED",
    "CANCELLED",
    "REJECTED",
  ],
  KITCHEN: ["ACCEPTED", "PREPARING", "READY", "REJECTED"],
  WAITER: ["SERVED", "CANCELLED"],
  CASHIER: [],
};

export function canRoleSetOrderStatus(role: Role, target: OrderStatus) {
  return roleStatusTargets[role].includes(target);
}

export function aggregatePreparationStatus(
  current: OrderStatus,
  itemStatuses: readonly OrderItemStatus[],
): OrderStatus {
  if (["SERVED", "CANCELLED", "REJECTED"].includes(current)) return current;
  if (current === "PENDING") return "PENDING";

  const active = itemStatuses.filter((status) => status !== "CANCELLED");
  if (active.length === 0) return "CANCELLED";
  if (active.every((status) => status === "READY")) return "READY";
  if (active.some((status) => status === "PREPARING" || status === "READY"))
    return "PREPARING";
  return "ACCEPTED";
}

export const unresolvedOrderStatuses: readonly OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
];
