import { z } from "zod";

import { publicMenuResponseSchema } from "./menu.js";
import { orderSchema } from "./orders.js";

const id = z.uuid();
const trimmed = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

export const publicTableIdentifierParamsSchema = z.object({
  identifier: trimmed(32, 64),
});

export const publicTableContextSchema = z.object({
  restaurant: z.object({
    name: trimmed(1, 200),
    currency: z.string().length(3),
  }),
  table: z.object({
    displayName: trimmed(1, 100),
    tableNumber: trimmed(1, 30),
  }),
  hasActiveSession: z.boolean(),
});

export const publicTableResponseSchema = z.object({
  context: publicTableContextSchema,
});

export const publicTableMenuResponseSchema = publicMenuResponseSchema.extend({
  context: publicTableContextSchema,
});

export const activateCustomerSessionRequestSchema = z
  .object({
    identifier: trimmed(32, 64),
    activationCode: trimmed(6, 12),
  })
  .strict();

export const customerSessionSchema = z.object({
  restaurantName: trimmed(1, 200),
  tableDisplayName: trimmed(1, 100),
  expiresAt: z.iso.datetime(),
});

export const customerSessionResponseSchema = z.object({
  session: customerSessionSchema,
});

export const issueActivationParamsSchema = z.object({ id });
export const tableOrderingActivationSchema = z.object({
  activationCode: trimmed(6, 12),
  expiresAt: z.iso.datetime(),
});
export const tableOrderingActivationResponseSchema = z.object({
  activation: tableOrderingActivationSchema,
});

export const customerOrderSchema = orderSchema
  .omit({ createdBy: true, tableSessionId: true })
  .extend({
    table: orderSchema.shape.table.omit({ id: true }),
    items: z.array(
      orderSchema.shape.items.element.omit({ menuItemId: true }).extend({
        modifiers: z.array(
          orderSchema.shape.items.element.shape.modifiers.element.omit({
            id: true,
            modifierGroupId: true,
            modifierId: true,
          }),
        ),
      }),
    ),
  });
export const customerOrderResponseSchema = z.object({
  order: customerOrderSchema,
});
export const customerOrderListResponseSchema = z.object({
  orders: z.array(customerOrderSchema),
});

export const customerOrderChangedEventSchema = z
  .object({
    eventId: id,
    schemaVersion: z.literal(1),
    orderId: id,
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

export type PublicTableContext = z.infer<typeof publicTableContextSchema>;
export type CustomerSession = z.infer<typeof customerSessionSchema>;
export type CustomerOrder = z.infer<typeof customerOrderSchema>;
export type CustomerOrderChangedEvent = z.infer<
  typeof customerOrderChangedEventSchema
>;
