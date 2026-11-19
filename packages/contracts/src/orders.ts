import { z } from "zod";

const id = z.uuid();
const trimmed = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

export const orderSourceSchema = z.enum(["WAITER", "CUSTOMER"]);
export const orderStatusSchema = z.enum([
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
  "REJECTED",
]);
export const orderItemStatusSchema = z.enum([
  "PENDING",
  "PREPARING",
  "READY",
  "SERVED",
  "CANCELLED",
]);

export const orderParamsSchema = z.object({ id });
export const idempotencyKeySchema = trimmed(8, 128);

export const orderItemInputSchema = z
  .object({
    menuItemId: id,
    quantity: z.number().int().min(1).max(99),
    modifierIds: z.array(id).max(50).default([]),
    specialInstructions: trimmed(1, 500).nullable().optional(),
  })
  .strict()
  .refine(
    (value) => new Set(value.modifierIds).size === value.modifierIds.length,
    { message: "A modifier can only be selected once.", path: ["modifierIds"] },
  );

const orderItemsInputSchema = z
  .array(orderItemInputSchema)
  .min(1, "Add at least one item.")
  .max(50);

export const createOrderRequestSchema = z
  .object({ tableSessionId: id, items: orderItemsInputSchema })
  .strict();

export const customerCreateOrderRequestSchema = z
  .object({ items: orderItemsInputSchema })
  .strict();

export const addOrderItemsRequestSchema = z
  .object({
    version: z.number().int().positive(),
    items: orderItemsInputSchema,
  })
  .strict();

export const updateOrderStatusRequestSchema = z
  .object({
    version: z.number().int().positive(),
    status: orderStatusSchema,
    reason: trimmed(1, 500).nullable().optional(),
  })
  .strict();

export const updateOrderItemStatusRequestSchema = z
  .object({
    version: z.number().int().positive(),
    status: orderItemStatusSchema,
    reason: trimmed(1, 500).nullable().optional(),
  })
  .strict();

export const kitchenTicketListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  statuses: z
    .preprocess(
      (value) =>
        typeof value === "string"
          ? value
              .split(",")
              .map((status) => status.trim())
              .filter(Boolean)
          : value,
      z.array(orderStatusSchema).min(1).max(7),
    )
    .default(["PENDING", "ACCEPTED", "PREPARING", "READY"]),
});

export const orderListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  tableSessionId: id.optional(),
  status: orderStatusSchema.optional(),
});

export const orderActorSchema = z.object({
  id,
  displayName: trimmed(1, 120),
});

export const orderItemModifierSchema = z.object({
  id,
  modifierGroupId: id.nullable(),
  modifierId: id.nullable(),
  modifierGroupNameSnapshot: trimmed(1, 100),
  modifierNameSnapshot: trimmed(1, 100),
  modifierPriceMinor: z.number().int().nonnegative(),
  quantity: z.number().int().positive(),
});

export const orderItemSchema = z.object({
  id,
  menuItemId: id,
  itemNameSnapshot: trimmed(1, 120),
  quantity: z.number().int().positive(),
  unitPriceMinor: z.number().int().nonnegative(),
  lineTotalMinor: z.number().int().nonnegative(),
  specialInstructions: z.string().max(500).nullable(),
  status: orderItemStatusSchema,
  batchNumber: z.number().int().positive(),
  modifiers: z.array(orderItemModifierSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const orderHistoryEntrySchema = z.object({
  id,
  previousStatus: orderStatusSchema.nullable(),
  newStatus: orderStatusSchema,
  actor: orderActorSchema,
  reason: z.string().max(500).nullable(),
  createdAt: z.iso.datetime(),
});

export const orderSchema = z.object({
  id,
  tableSessionId: id,
  table: z.object({
    id,
    tableNumber: trimmed(1, 30),
    displayName: trimmed(1, 100),
  }),
  orderNumber: trimmed(1, 32),
  source: orderSourceSchema,
  status: orderStatusSchema,
  version: z.number().int().positive(),
  totalMinor: z.number().int().nonnegative(),
  createdBy: orderActorSchema,
  items: z.array(orderItemSchema),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const orderResponseSchema = z.object({ order: orderSchema });
export const orderListResponseSchema = z.object({
  orders: z.array(orderSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
export const kitchenTicketListResponseSchema = z.object({
  orders: z.array(orderSchema),
});
export const orderHistoryResponseSchema = z.object({
  history: z.array(orderHistoryEntrySchema),
});

export type OrderSource = z.infer<typeof orderSourceSchema>;
export type OrderStatus = z.infer<typeof orderStatusSchema>;
export type OrderItemStatus = z.infer<typeof orderItemStatusSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type CreateOrderRequest = z.infer<typeof createOrderRequestSchema>;
export type CustomerCreateOrderRequest = z.infer<
  typeof customerCreateOrderRequestSchema
>;
export type AddOrderItemsRequest = z.infer<typeof addOrderItemsRequestSchema>;
export type UpdateOrderStatusRequest = z.infer<
  typeof updateOrderStatusRequestSchema
>;
export type UpdateOrderItemStatusRequest = z.infer<
  typeof updateOrderItemStatusRequestSchema
>;
export type KitchenTicketListQuery = z.infer<
  typeof kitchenTicketListQuerySchema
>;
export type OrderListQuery = z.infer<typeof orderListQuerySchema>;
export type Order = z.infer<typeof orderSchema>;
export type OrderItem = z.infer<typeof orderItemSchema>;
export type OrderHistoryEntry = z.infer<typeof orderHistoryEntrySchema>;
