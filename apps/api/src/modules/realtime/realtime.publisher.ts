import { randomUUID } from "node:crypto";

import type { OrderChangedEvent } from "@restroflow/contracts";

export type OrderChangeType = OrderChangedEvent["changeType"];

export interface RealtimePublisher {
  orderChanged(input: {
    restaurantId: string;
    orderId: string;
    orderVersion: number;
    changeType: OrderChangeType;
    customerOrderingSessionId?: string | null;
  }): Promise<void>;
}

export class NoopRealtimePublisher implements RealtimePublisher {
  orderChanged(): Promise<void> {
    return Promise.resolve();
  }
}

export function createOrderChangedEvent(input: {
  restaurantId: string;
  orderId: string;
  orderVersion: number;
  changeType: OrderChangeType;
}): OrderChangedEvent {
  return {
    eventId: randomUUID(),
    schemaVersion: 1,
    restaurantId: input.restaurantId,
    orderId: input.orderId,
    orderVersion: input.orderVersion,
    changeType: input.changeType,
    occurredAt: new Date().toISOString(),
  };
}
