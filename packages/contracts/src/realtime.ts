import { z } from "zod";

export const realtimeChannelSchema = z.enum([
  "restaurant",
  "kitchen",
  "waiters",
]);

export const realtimeSubscriptionSchema = z
  .object({ channel: realtimeChannelSchema })
  .strict();

export const orderChangedEventSchema = z
  .object({
    eventId: z.uuid(),
    schemaVersion: z.literal(1),
    restaurantId: z.uuid(),
    orderId: z.uuid(),
    changeType: z.enum([
      "CREATED",
      "ITEMS_ADDED",
      "STATUS_UPDATED",
      "ITEM_UPDATED",
    ]),
    orderVersion: z.number().int().positive(),
    occurredAt: z.iso.datetime(),
  })
  .strict();

export type RealtimeChannel = z.infer<typeof realtimeChannelSchema>;
export type RealtimeSubscription = z.infer<typeof realtimeSubscriptionSchema>;
export type OrderChangedEvent = z.infer<typeof orderChangedEventSchema>;
