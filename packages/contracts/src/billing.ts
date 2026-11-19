import { z } from "zod";

const id = z.uuid();
const money = z.number().int().min(0).max(2_147_483_647);
const trimmed = (minimum: number, maximum: number) =>
  z.string().trim().min(minimum).max(maximum);

export const billStatusSchema = z.enum(["FINALIZED", "PARTIALLY_PAID", "PAID"]);
export const paymentMethodSchema = z.enum(["CASH", "UPI"]);
export const paymentStatusSchema = z.literal("RECORDED");
export const billParamsSchema = z.object({ id });

export const createPaymentRequestSchema = z
  .object({
    amountMinor: z.number().int().min(1).max(2_147_483_647),
    method: paymentMethodSchema,
    reference: trimmed(1, 120).nullable().optional(),
    note: trimmed(1, 500).nullable().optional(),
    receivedExternally: z.literal(true, {
      error: "Confirm that the payment was received before recording it.",
    }),
  })
  .strict();

export const billListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: billStatusSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

export const billingActorSchema = z.object({
  id,
  displayName: trimmed(1, 120),
});

export const billRestaurantSchema = z.object({
  id,
  name: trimmed(1, 120),
  address: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.email().nullable(),
});

export const billTableSchema = z.object({
  id,
  tableNumber: trimmed(1, 30),
  displayName: trimmed(1, 100),
});

export const billItemModifierSchema = z.object({
  id,
  modifierGroupNameSnapshot: trimmed(1, 100),
  modifierNameSnapshot: trimmed(1, 100),
  modifierPriceMinor: money,
  quantity: z.number().int().positive(),
});

export const billItemSchema = z.object({
  id,
  sourceOrderItemId: id,
  orderNumberSnapshot: trimmed(1, 32),
  itemNameSnapshot: trimmed(1, 120),
  quantity: z.number().int().positive(),
  unitPriceMinor: money,
  modifierSubtotalMinor: money,
  lineSubtotalMinor: money,
  taxAmountMinor: money,
  finalLineAmountMinor: money,
  batchNumber: z.number().int().positive(),
  modifiers: z.array(billItemModifierSchema),
});

export const paymentSchema = z.object({
  id,
  amountMinor: z.number().int().positive(),
  method: paymentMethodSchema,
  status: paymentStatusSchema,
  reference: z.string().max(120).nullable(),
  note: z.string().max(500).nullable(),
  recordedBy: billingActorSchema,
  recordedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
});

export const billSchema = z.object({
  id,
  tableSessionId: id,
  billNumber: trimmed(1, 40),
  status: billStatusSchema,
  version: z.number().int().positive(),
  currency: z.string().length(3),
  taxName: trimmed(1, 40),
  taxRateBasisPoints: z.number().int().min(0).max(10_000),
  pricesIncludeTax: z.boolean(),
  roundingPolicy: trimmed(1, 40),
  subtotalMinor: money,
  taxMinor: money,
  totalMinor: money,
  amountPaidMinor: money,
  outstandingMinor: money,
  restaurant: billRestaurantSchema,
  table: billTableSchema,
  createdBy: billingActorSchema,
  finalizedBy: billingActorSchema,
  items: z.array(billItemSchema),
  payments: z.array(paymentSchema),
  finalizedAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const billPreviewItemSchema = billItemSchema.omit({ id: true });
export const billPreviewSchema = z.object({
  tableSessionId: id,
  currency: z.string().length(3),
  taxName: trimmed(1, 40),
  taxRateBasisPoints: z.number().int().min(0).max(10_000),
  pricesIncludeTax: z.boolean(),
  roundingPolicy: trimmed(1, 40),
  subtotalMinor: money,
  taxMinor: money,
  totalMinor: money,
  canFinalize: z.boolean(),
  blockingOrderCount: z.number().int().nonnegative(),
  restaurant: billRestaurantSchema,
  table: billTableSchema,
  items: z.array(billPreviewItemSchema),
});

export const activeBillingSessionSchema = z.object({
  tableSessionId: id,
  table: billTableSchema,
  openedAt: z.iso.datetime(),
  orderCount: z.number().int().nonnegative(),
  unresolvedOrderCount: z.number().int().nonnegative(),
  billingStatus: z.enum(["UNBILLED", "FINALIZED", "PARTIALLY_PAID", "PAID"]),
  billId: id.nullable(),
  totalMinor: money.nullable(),
  outstandingMinor: money.nullable(),
  currency: z.string().length(3),
});

export const billResponseSchema = z.object({ bill: billSchema });
export const billPreviewResponseSchema = z.object({
  preview: billPreviewSchema,
});
export const activeBillingSessionListResponseSchema = z.object({
  sessions: z.array(activeBillingSessionSchema),
});
export const billListResponseSchema = z.object({
  bills: z.array(billSchema),
  pagination: z.object({
    page: z.number().int().positive(),
    limit: z.number().int().positive(),
    total: z.number().int().nonnegative(),
    totalPages: z.number().int().nonnegative(),
  }),
});
export const paymentResponseSchema = z.object({
  payment: paymentSchema,
  bill: billSchema,
});
export const paymentListResponseSchema = z.object({
  payments: z.array(paymentSchema),
});

export type BillStatus = z.infer<typeof billStatusSchema>;
export type PaymentMethod = z.infer<typeof paymentMethodSchema>;
export type CreatePaymentRequest = z.infer<typeof createPaymentRequestSchema>;
export type BillListQuery = z.infer<typeof billListQuerySchema>;
export type Bill = z.infer<typeof billSchema>;
export type BillItem = z.infer<typeof billItemSchema>;
export type BillPreview = z.infer<typeof billPreviewSchema>;
export type BillPreviewItem = z.infer<typeof billPreviewItemSchema>;
export type Payment = z.infer<typeof paymentSchema>;
export type ActiveBillingSession = z.infer<typeof activeBillingSessionSchema>;
