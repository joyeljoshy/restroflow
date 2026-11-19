import type { OrderStatus } from "@restroflow/contracts";

export const partSixTransitions: Readonly<
  Record<OrderStatus, readonly OrderStatus[]>
> = {
  PENDING: ["ACCEPTED", "REJECTED", "CANCELLED"],
  ACCEPTED: ["SERVED", "CANCELLED"],
  PREPARING: [],
  READY: [],
  SERVED: [],
  CANCELLED: [],
  REJECTED: [],
};

export const unresolvedOrderStatuses: readonly OrderStatus[] = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
];
