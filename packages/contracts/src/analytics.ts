import { z } from "zod";

const localDate = z.iso.date();
const count = z.number().int().nonnegative();
const duration = z.number().int().nonnegative().nullable();
export const analyticsMoneySchema = z.string().regex(/^\d+$/);
export const analyticsGranularitySchema = z.enum(["day", "week", "month"]);

function dateValue(value: string): number {
  return Date.parse(`${value}T00:00:00.000Z`);
}

export const analyticsRangeQuerySchema = z
  .object({
    startDate: localDate,
    endDate: localDate,
    granularity: analyticsGranularitySchema.default("day"),
  })
  .strict()
  .superRefine((value, context) => {
    const start = dateValue(value.startDate);
    const end = dateValue(value.endDate);
    if (end <= start) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "endDate must be after startDate.",
      });
    } else if (end - start > 366 * 24 * 60 * 60 * 1000) {
      context.addIssue({
        code: "custom",
        path: ["endDate"],
        message: "Analytics ranges cannot exceed 366 days.",
      });
    }
  });

export const popularItemsQuerySchema = analyticsRangeQuerySchema.and(
  z.object({ limit: z.coerce.number().int().min(1).max(10).default(5) }),
);

export const analyticsContextSchema = z.object({
  startDate: localDate,
  endDate: localDate,
  granularity: analyticsGranularitySchema,
  timezone: z.string().min(1),
  currency: z.string().length(3),
  endExclusive: z.literal(true),
});

export const comparisonMetricSchema = z.object({
  value: analyticsMoneySchema,
  previousValue: analyticsMoneySchema,
  changePercent: z.number().finite().nullable(),
});

export const countComparisonMetricSchema = z.object({
  value: count,
  previousValue: count,
  changePercent: z.number().finite().nullable(),
});

export const analyticsOverviewSchema = z.object({
  context: analyticsContextSchema,
  finalizedSales: comparisonMetricSchema,
  recordedPayments: comparisonMetricSchema,
  currentOutstandingMinor: analyticsMoneySchema,
  periodOutstandingMinor: analyticsMoneySchema,
  finalizedBillCount: countComparisonMetricSchema,
  completedOrderCount: countComparisonMetricSchema,
  averageBillValueMinor: analyticsMoneySchema,
  activeTableSessions: count,
  activeKitchenOrders: count,
});

export const trendPointSchema = z.object({
  period: localDate,
  amountMinor: analyticsMoneySchema,
  count,
});

export const salesAnalyticsSchema = z.object({
  context: analyticsContextSchema,
  points: z.array(trendPointSchema),
});

export const paymentMethodTotalSchema = z.object({
  method: z.enum(["CASH", "UPI"]),
  amountMinor: analyticsMoneySchema,
  paymentCount: count,
});

export const paymentAnalyticsSchema = z.object({
  context: analyticsContextSchema,
  totalRecordedMinor: analyticsMoneySchema,
  methods: z.array(paymentMethodTotalSchema),
  points: z.array(trendPointSchema),
  partiallyPaidBillCount: count,
  currentOutstandingMinor: analyticsMoneySchema,
  periodOutstandingMinor: analyticsMoneySchema,
});

export const popularItemSchema = z.object({
  menuItemId: z.uuid(),
  itemName: z.string().min(1),
  quantitySold: count,
  salesContributionMinor: analyticsMoneySchema,
  popularityPercent: z.number().min(0).max(100),
});

export const popularItemsAnalyticsSchema = z.object({
  context: analyticsContextSchema,
  items: z.array(popularItemSchema),
});

export const orderVolumePointSchema = z.object({
  period: localDate,
  created: count,
});

export const orderAnalyticsSchema = z.object({
  context: analyticsContextSchema,
  ordersCreated: count,
  ordersServed: count,
  ordersCancelled: count,
  ordersRejected: count,
  sourceBreakdown: z.object({ waiter: count, customer: count }),
  peakOrderingHour: z.number().int().min(0).max(23).nullable(),
  points: z.array(orderVolumePointSchema),
});

export const tableUsageSchema = z.object({
  tableId: z.uuid(),
  displayName: z.string().min(1),
  completedSessions: count,
});

export const tableAnalyticsSchema = z.object({
  context: analyticsContextSchema,
  activeTables: count,
  currentlyOccupiedTables: count,
  availableTables: count,
  completedSessions: count,
  averageOccupiedDurationMinutes: duration,
  usage: z.array(tableUsageSchema),
});

export const kitchenAnalyticsSchema = z.object({
  context: analyticsContextSchema,
  activePreparingOrders: count,
  readyForServingOrders: count,
  averageQueueToPreparingMinutes: duration,
  averagePreparationMinutes: duration,
  averageTotalToReadyMinutes: duration,
  completedItemSamples: count,
});

export const analyticsOverviewResponseSchema = z.object({
  overview: analyticsOverviewSchema,
});
export const salesAnalyticsResponseSchema = z.object({
  sales: salesAnalyticsSchema,
});
export const paymentAnalyticsResponseSchema = z.object({
  payments: paymentAnalyticsSchema,
});
export const popularItemsAnalyticsResponseSchema = z.object({
  popularItems: popularItemsAnalyticsSchema,
});
export const orderAnalyticsResponseSchema = z.object({
  orders: orderAnalyticsSchema,
});
export const tableAnalyticsResponseSchema = z.object({
  tables: tableAnalyticsSchema,
});
export const kitchenAnalyticsResponseSchema = z.object({
  kitchen: kitchenAnalyticsSchema,
});

export type AnalyticsRangeQuery = z.infer<typeof analyticsRangeQuerySchema>;
export type AnalyticsGranularity = z.infer<typeof analyticsGranularitySchema>;
export type PopularItemsQuery = z.infer<typeof popularItemsQuerySchema>;
export type AnalyticsContext = z.infer<typeof analyticsContextSchema>;
export type AnalyticsOverview = z.infer<typeof analyticsOverviewSchema>;
export type SalesAnalytics = z.infer<typeof salesAnalyticsSchema>;
export type PaymentAnalytics = z.infer<typeof paymentAnalyticsSchema>;
export type PopularItemsAnalytics = z.infer<typeof popularItemsAnalyticsSchema>;
export type OrderAnalytics = z.infer<typeof orderAnalyticsSchema>;
export type TableAnalytics = z.infer<typeof tableAnalyticsSchema>;
export type KitchenAnalytics = z.infer<typeof kitchenAnalyticsSchema>;
