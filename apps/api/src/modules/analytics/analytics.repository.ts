import type { PrismaClient } from "../../generated/prisma/client.js";

export type RestaurantAnalyticsContext = {
  timezone: string;
  currency: string;
};

export type OverviewRow = {
  finalizedSalesMinor: bigint;
  previousFinalizedSalesMinor: bigint;
  recordedPaymentsMinor: bigint;
  previousRecordedPaymentsMinor: bigint;
  currentOutstandingMinor: bigint;
  periodOutstandingMinor: bigint;
  finalizedBillCount: bigint;
  previousFinalizedBillCount: bigint;
  completedOrderCount: bigint;
  previousCompletedOrderCount: bigint;
  averageBillValueMinor: bigint;
  activeTableSessions: bigint;
  activeKitchenOrders: bigint;
};

export type TrendRow = {
  period: string;
  amountMinor: bigint;
  count: bigint;
};

export type PaymentMethodRow = {
  method: "CASH" | "UPI";
  amountMinor: bigint;
  paymentCount: bigint;
};

export type PaymentSummaryRow = {
  totalRecordedMinor: bigint;
  partiallyPaidBillCount: bigint;
  currentOutstandingMinor: bigint;
  periodOutstandingMinor: bigint;
};

export type PopularItemRow = {
  menuItemId: string;
  itemName: string;
  quantitySold: bigint;
  salesContributionMinor: bigint;
  totalQuantity: bigint;
};

export type OrderSummaryRow = {
  ordersCreated: bigint;
  ordersServed: bigint;
  ordersCancelled: bigint;
  ordersRejected: bigint;
  waiterOrders: bigint;
  customerOrders: bigint;
  peakOrderingHour: number | null;
};

export type OrderVolumeRow = { period: string; created: bigint };

export type TableSummaryRow = {
  activeTables: bigint;
  currentlyOccupiedTables: bigint;
  completedSessions: bigint;
  averageOccupiedDurationMinutes: number | null;
};

export type TableUsageRow = {
  tableId: string;
  displayName: string;
  completedSessions: bigint;
};

export type KitchenSummaryRow = {
  activePreparingOrders: bigint;
  readyForServingOrders: bigint;
  averageQueueToPreparingMinutes: number | null;
  averagePreparationMinutes: number | null;
  averageTotalToReadyMinutes: number | null;
  completedItemSamples: bigint;
};

export interface AnalyticsRepository {
  getContext(restaurantId: string): Promise<RestaurantAnalyticsContext | null>;
  overview(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
    previousStartDate: string,
    previousEndDate: string,
  ): Promise<OverviewRow>;
  sales(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
    granularity: string,
  ): Promise<TrendRow[]>;
  payments(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
    granularity: string,
  ): Promise<{
    summary: PaymentSummaryRow;
    methods: PaymentMethodRow[];
    points: TrendRow[];
  }>;
  popularItems(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
    limit: number,
  ): Promise<PopularItemRow[]>;
  orders(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
    granularity: string,
  ): Promise<{ summary: OrderSummaryRow; points: OrderVolumeRow[] }>;
  tables(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
  ): Promise<{ summary: TableSummaryRow; usage: TableUsageRow[] }>;
  kitchen(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
  ): Promise<KitchenSummaryRow>;
}

function first<T>(rows: T[], label: string): T {
  const row = rows[0];
  if (!row) throw new Error(`Analytics query returned no ${label} row.`);
  return row;
}

export class PrismaAnalyticsRepository implements AnalyticsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  getContext(restaurantId: string): Promise<RestaurantAnalyticsContext | null> {
    return this.prisma.restaurant.findUnique({
      where: { id: restaurantId },
      select: { timezone: true, currency: true },
    });
  }

  async overview(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
    previousStartDate: string,
    previousEndDate: string,
  ): Promise<OverviewRow> {
    const rows = await this.prisma.$queryRaw<OverviewRow[]>`
      WITH bounds AS (
        SELECT
          ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc,
          ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc,
          ((${previousStartDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS previous_start_utc,
          ((${previousEndDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS previous_end_utc
      )
      SELECT
        COALESCE((SELECT SUM(b."totalMinor")::bigint FROM "Bill" b, bounds x
          WHERE b."restaurantId" = ${restaurantId}::uuid AND b."finalizedAt" >= x.start_utc AND b."finalizedAt" < x.end_utc), 0)::bigint AS "finalizedSalesMinor",
        COALESCE((SELECT SUM(b."totalMinor")::bigint FROM "Bill" b, bounds x
          WHERE b."restaurantId" = ${restaurantId}::uuid AND b."finalizedAt" >= x.previous_start_utc AND b."finalizedAt" < x.previous_end_utc), 0)::bigint AS "previousFinalizedSalesMinor",
        COALESCE((SELECT SUM(p."amountMinor")::bigint FROM "Payment" p, bounds x
          WHERE p."restaurantId" = ${restaurantId}::uuid AND p.status = 'RECORDED' AND p."recordedAt" >= x.start_utc AND p."recordedAt" < x.end_utc), 0)::bigint AS "recordedPaymentsMinor",
        COALESCE((SELECT SUM(p."amountMinor")::bigint FROM "Payment" p, bounds x
          WHERE p."restaurantId" = ${restaurantId}::uuid AND p.status = 'RECORDED' AND p."recordedAt" >= x.previous_start_utc AND p."recordedAt" < x.previous_end_utc), 0)::bigint AS "previousRecordedPaymentsMinor",
        COALESCE((SELECT SUM((b."totalMinor" - b."amountPaidMinor")::bigint) FROM "Bill" b
          WHERE b."restaurantId" = ${restaurantId}::uuid AND b.status IN ('FINALIZED', 'PARTIALLY_PAID')), 0)::bigint AS "currentOutstandingMinor",
        COALESCE((SELECT SUM((b."totalMinor" - b."amountPaidMinor")::bigint) FROM "Bill" b, bounds x
          WHERE b."restaurantId" = ${restaurantId}::uuid AND b.status IN ('FINALIZED', 'PARTIALLY_PAID') AND b."finalizedAt" >= x.start_utc AND b."finalizedAt" < x.end_utc), 0)::bigint AS "periodOutstandingMinor",
        (SELECT COUNT(*)::bigint FROM "Bill" b, bounds x
          WHERE b."restaurantId" = ${restaurantId}::uuid AND b."finalizedAt" >= x.start_utc AND b."finalizedAt" < x.end_utc) AS "finalizedBillCount",
        (SELECT COUNT(*)::bigint FROM "Bill" b, bounds x
          WHERE b."restaurantId" = ${restaurantId}::uuid AND b."finalizedAt" >= x.previous_start_utc AND b."finalizedAt" < x.previous_end_utc) AS "previousFinalizedBillCount",
        (SELECT COUNT(DISTINCT h."orderId")::bigint FROM "OrderStatusHistory" h, bounds x
          WHERE h."restaurantId" = ${restaurantId}::uuid AND h."newStatus" = 'SERVED' AND h."createdAt" >= x.start_utc AND h."createdAt" < x.end_utc) AS "completedOrderCount",
        (SELECT COUNT(DISTINCT h."orderId")::bigint FROM "OrderStatusHistory" h, bounds x
          WHERE h."restaurantId" = ${restaurantId}::uuid AND h."newStatus" = 'SERVED' AND h."createdAt" >= x.previous_start_utc AND h."createdAt" < x.previous_end_utc) AS "previousCompletedOrderCount",
        COALESCE((SELECT ROUND(AVG(b."totalMinor"::numeric))::bigint FROM "Bill" b, bounds x
          WHERE b."restaurantId" = ${restaurantId}::uuid AND b."finalizedAt" >= x.start_utc AND b."finalizedAt" < x.end_utc), 0)::bigint AS "averageBillValueMinor",
        (SELECT COUNT(*)::bigint FROM "TableSession" s
          WHERE s."restaurantId" = ${restaurantId}::uuid AND s.status = 'OPEN') AS "activeTableSessions",
        (SELECT COUNT(*)::bigint FROM "Order" o
          WHERE o."restaurantId" = ${restaurantId}::uuid AND o.status IN ('PENDING', 'ACCEPTED', 'PREPARING', 'READY')) AS "activeKitchenOrders"
    `;
    return first(rows, "overview");
  }

  sales(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
    granularity: string,
  ): Promise<TrendRow[]> {
    return this.prisma.$queryRaw<TrendRow[]>`
      WITH bounds AS (
        SELECT ${startDate}::date::timestamp AS start_local, ${endDate}::date::timestamp AS end_local,
          ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc,
          ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc
      ), buckets AS (
        SELECT generate_series(
          date_trunc(${granularity}, start_local),
          date_trunc(${granularity}, end_local - interval '1 microsecond'),
          CASE ${granularity} WHEN 'day' THEN interval '1 day' WHEN 'week' THEN interval '1 week' ELSE interval '1 month' END
        ) AS bucket FROM bounds
      )
      SELECT to_char(k.bucket, 'YYYY-MM-DD') AS period,
        COALESCE(SUM(b."totalMinor"), 0)::bigint AS "amountMinor",
        COUNT(b.id)::bigint AS count
      FROM buckets k CROSS JOIN bounds x
      LEFT JOIN "Bill" b ON b."restaurantId" = ${restaurantId}::uuid
        AND b."finalizedAt" >= x.start_utc AND b."finalizedAt" < x.end_utc
        AND date_trunc(${granularity}, (b."finalizedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}) = k.bucket
      GROUP BY k.bucket ORDER BY k.bucket
    `;
  }

  async payments(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
    granularity: string,
  ) {
    const [summaryRows, methods, points] = await Promise.all([
      this.prisma.$queryRaw<PaymentSummaryRow[]>`
        WITH bounds AS (SELECT
          ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc,
          ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc)
        SELECT
          COALESCE((SELECT SUM(p."amountMinor")::bigint FROM "Payment" p, bounds x WHERE p."restaurantId" = ${restaurantId}::uuid AND p.status = 'RECORDED' AND p."recordedAt" >= x.start_utc AND p."recordedAt" < x.end_utc), 0)::bigint AS "totalRecordedMinor",
          (SELECT COUNT(*)::bigint FROM "Bill" b WHERE b."restaurantId" = ${restaurantId}::uuid AND b.status = 'PARTIALLY_PAID') AS "partiallyPaidBillCount",
          COALESCE((SELECT SUM((b."totalMinor" - b."amountPaidMinor")::bigint) FROM "Bill" b WHERE b."restaurantId" = ${restaurantId}::uuid AND b.status IN ('FINALIZED', 'PARTIALLY_PAID')), 0)::bigint AS "currentOutstandingMinor",
          COALESCE((SELECT SUM((b."totalMinor" - b."amountPaidMinor")::bigint) FROM "Bill" b, bounds x WHERE b."restaurantId" = ${restaurantId}::uuid AND b.status IN ('FINALIZED', 'PARTIALLY_PAID') AND b."finalizedAt" >= x.start_utc AND b."finalizedAt" < x.end_utc), 0)::bigint AS "periodOutstandingMinor"
      `,
      this.prisma.$queryRaw<PaymentMethodRow[]>`
        WITH bounds AS (SELECT ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc, ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc)
        SELECT p.method::text AS method, SUM(p."amountMinor")::bigint AS "amountMinor", COUNT(*)::bigint AS "paymentCount"
        FROM "Payment" p, bounds x WHERE p."restaurantId" = ${restaurantId}::uuid AND p.status = 'RECORDED' AND p."recordedAt" >= x.start_utc AND p."recordedAt" < x.end_utc
        GROUP BY p.method ORDER BY p.method
      `,
      this.prisma.$queryRaw<TrendRow[]>`
        WITH bounds AS (SELECT ${startDate}::date::timestamp AS start_local, ${endDate}::date::timestamp AS end_local, ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc, ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc),
        buckets AS (SELECT generate_series(date_trunc(${granularity}, start_local), date_trunc(${granularity}, end_local - interval '1 microsecond'), CASE ${granularity} WHEN 'day' THEN interval '1 day' WHEN 'week' THEN interval '1 week' ELSE interval '1 month' END) AS bucket FROM bounds)
        SELECT to_char(k.bucket, 'YYYY-MM-DD') AS period, COALESCE(SUM(p."amountMinor"), 0)::bigint AS "amountMinor", COUNT(p.id)::bigint AS count
        FROM buckets k CROSS JOIN bounds x LEFT JOIN "Payment" p ON p."restaurantId" = ${restaurantId}::uuid AND p.status = 'RECORDED' AND p."recordedAt" >= x.start_utc AND p."recordedAt" < x.end_utc AND date_trunc(${granularity}, (p."recordedAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}) = k.bucket
        GROUP BY k.bucket ORDER BY k.bucket
      `,
    ]);
    return { summary: first(summaryRows, "payment summary"), methods, points };
  }

  popularItems(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
    limit: number,
  ): Promise<PopularItemRow[]> {
    return this.prisma.$queryRaw<PopularItemRow[]>`
      WITH bounds AS (SELECT ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc, ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc),
      eligible AS (
        SELECT bi.*, oi."menuItemId", b."finalizedAt"
        FROM "BillItem" bi JOIN "Bill" b ON b.id = bi."billId" AND b."restaurantId" = bi."restaurantId"
        JOIN "OrderItem" oi ON oi.id = bi."sourceOrderItemId" AND oi."restaurantId" = bi."restaurantId", bounds x
        WHERE bi."restaurantId" = ${restaurantId}::uuid AND b."finalizedAt" >= x.start_utc AND b."finalizedAt" < x.end_utc
      ), names AS (
        SELECT DISTINCT ON ("menuItemId") "menuItemId", "itemNameSnapshot" FROM eligible ORDER BY "menuItemId", "finalizedAt" DESC, id DESC
      )
      SELECT e."menuItemId" AS "menuItemId", n."itemNameSnapshot" AS "itemName",
        SUM(e.quantity)::bigint AS "quantitySold", SUM(e."finalLineAmountMinor")::bigint AS "salesContributionMinor",
        SUM(SUM(e.quantity)) OVER ()::bigint AS "totalQuantity"
      FROM eligible e JOIN names n ON n."menuItemId" = e."menuItemId"
      GROUP BY e."menuItemId", n."itemNameSnapshot"
      ORDER BY "quantitySold" DESC, "salesContributionMinor" DESC, e."menuItemId" ASC LIMIT ${limit}
    `;
  }

  async orders(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
    granularity: string,
  ) {
    const [summaryRows, points] = await Promise.all([
      this.prisma.$queryRaw<OrderSummaryRow[]>`
        WITH bounds AS (SELECT ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc, ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc),
        peak AS (SELECT EXTRACT(HOUR FROM (o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone})::integer AS hour, COUNT(*) AS total FROM "Order" o, bounds x WHERE o."restaurantId" = ${restaurantId}::uuid AND o."createdAt" >= x.start_utc AND o."createdAt" < x.end_utc GROUP BY hour ORDER BY total DESC, hour ASC LIMIT 1)
        SELECT
          (SELECT COUNT(*)::bigint FROM "Order" o, bounds x WHERE o."restaurantId" = ${restaurantId}::uuid AND o."createdAt" >= x.start_utc AND o."createdAt" < x.end_utc) AS "ordersCreated",
          (SELECT COUNT(DISTINCT h."orderId")::bigint FROM "OrderStatusHistory" h, bounds x WHERE h."restaurantId" = ${restaurantId}::uuid AND h."newStatus" = 'SERVED' AND h."createdAt" >= x.start_utc AND h."createdAt" < x.end_utc) AS "ordersServed",
          (SELECT COUNT(DISTINCT h."orderId")::bigint FROM "OrderStatusHistory" h, bounds x WHERE h."restaurantId" = ${restaurantId}::uuid AND h."newStatus" = 'CANCELLED' AND h."createdAt" >= x.start_utc AND h."createdAt" < x.end_utc) AS "ordersCancelled",
          (SELECT COUNT(DISTINCT h."orderId")::bigint FROM "OrderStatusHistory" h, bounds x WHERE h."restaurantId" = ${restaurantId}::uuid AND h."newStatus" = 'REJECTED' AND h."createdAt" >= x.start_utc AND h."createdAt" < x.end_utc) AS "ordersRejected",
          (SELECT COUNT(*)::bigint FROM "Order" o, bounds x WHERE o."restaurantId" = ${restaurantId}::uuid AND o.source = 'WAITER' AND o."createdAt" >= x.start_utc AND o."createdAt" < x.end_utc) AS "waiterOrders",
          (SELECT COUNT(*)::bigint FROM "Order" o, bounds x WHERE o."restaurantId" = ${restaurantId}::uuid AND o.source = 'CUSTOMER' AND o."createdAt" >= x.start_utc AND o."createdAt" < x.end_utc) AS "customerOrders",
          (SELECT hour FROM peak) AS "peakOrderingHour"
      `,
      this.prisma.$queryRaw<OrderVolumeRow[]>`
        WITH bounds AS (SELECT ${startDate}::date::timestamp AS start_local, ${endDate}::date::timestamp AS end_local, ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc, ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc), buckets AS (SELECT generate_series(date_trunc(${granularity}, start_local), date_trunc(${granularity}, end_local - interval '1 microsecond'), CASE ${granularity} WHEN 'day' THEN interval '1 day' WHEN 'week' THEN interval '1 week' ELSE interval '1 month' END) AS bucket FROM bounds)
        SELECT to_char(k.bucket, 'YYYY-MM-DD') AS period, COUNT(o.id)::bigint AS created FROM buckets k CROSS JOIN bounds x LEFT JOIN "Order" o ON o."restaurantId" = ${restaurantId}::uuid AND o."createdAt" >= x.start_utc AND o."createdAt" < x.end_utc AND date_trunc(${granularity}, (o."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${timezone}) = k.bucket GROUP BY k.bucket ORDER BY k.bucket
      `,
    ]);
    return { summary: first(summaryRows, "order summary"), points };
  }

  async tables(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
  ) {
    const [summaryRows, usage] = await Promise.all([
      this.prisma.$queryRaw<TableSummaryRow[]>`
        WITH bounds AS (SELECT ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc, ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc)
        SELECT
          (SELECT COUNT(*)::bigint FROM "RestaurantTable" t WHERE t."restaurantId" = ${restaurantId}::uuid AND t."isActive") AS "activeTables",
          (SELECT COUNT(DISTINCT s."tableId")::bigint FROM "TableSession" s WHERE s."restaurantId" = ${restaurantId}::uuid AND s.status = 'OPEN') AS "currentlyOccupiedTables",
          (SELECT COUNT(*)::bigint FROM "TableSession" s, bounds x WHERE s."restaurantId" = ${restaurantId}::uuid AND s.status = 'CLOSED' AND s."closedAt" >= x.start_utc AND s."closedAt" < x.end_utc) AS "completedSessions",
          (SELECT ROUND(AVG(EXTRACT(EPOCH FROM (s."closedAt" - s."openedAt")) / 60))::integer FROM "TableSession" s, bounds x WHERE s."restaurantId" = ${restaurantId}::uuid AND s.status = 'CLOSED' AND s."closedAt" >= x.start_utc AND s."closedAt" < x.end_utc AND s."closedAt" >= s."openedAt") AS "averageOccupiedDurationMinutes"
      `,
      this.prisma.$queryRaw<TableUsageRow[]>`
        WITH bounds AS (SELECT ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc, ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc)
        SELECT t.id AS "tableId", t."displayName", COUNT(s.id)::bigint AS "completedSessions"
        FROM "RestaurantTable" t LEFT JOIN "TableSession" s ON s."tableId" = t.id AND s."restaurantId" = t."restaurantId" AND s.status = 'CLOSED' AND s."closedAt" >= (SELECT start_utc FROM bounds) AND s."closedAt" < (SELECT end_utc FROM bounds)
        WHERE t."restaurantId" = ${restaurantId}::uuid GROUP BY t.id, t."displayName" ORDER BY "completedSessions" DESC, t."displayName" ASC, t.id ASC LIMIT 10
      `,
    ]);
    return { summary: first(summaryRows, "table summary"), usage };
  }

  async kitchen(
    restaurantId: string,
    timezone: string,
    startDate: string,
    endDate: string,
  ): Promise<KitchenSummaryRow> {
    const rows = await this.prisma.$queryRaw<KitchenSummaryRow[]>`
      WITH bounds AS (SELECT ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc, ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc), transitions AS (
        SELECT oi.id,
          MIN(h."createdAt") FILTER (WHERE h."newStatus" = 'PENDING') AS submitted_at,
          MIN(h."createdAt") FILTER (WHERE h."newStatus" = 'PREPARING') AS preparing_at,
          MIN(h."createdAt") FILTER (WHERE h."newStatus" = 'READY') AS ready_at
        FROM "OrderItem" oi JOIN "Order" o ON o.id = oi."orderId" AND o."restaurantId" = oi."restaurantId"
        JOIN "OrderItemStatusHistory" h ON h."orderItemId" = oi.id AND h."restaurantId" = oi."restaurantId", bounds x
        WHERE oi."restaurantId" = ${restaurantId}::uuid AND oi.status <> 'CANCELLED' AND o.status NOT IN ('CANCELLED', 'REJECTED')
        GROUP BY oi.id
      ), valid AS (SELECT * FROM transitions, bounds x WHERE ready_at >= x.start_utc AND ready_at < x.end_utc AND submitted_at IS NOT NULL AND preparing_at IS NOT NULL AND ready_at IS NOT NULL AND submitted_at <= preparing_at AND preparing_at <= ready_at)
      SELECT
        (SELECT COUNT(*)::bigint FROM "Order" o WHERE o."restaurantId" = ${restaurantId}::uuid AND o.status IN ('ACCEPTED', 'PREPARING')) AS "activePreparingOrders",
        (SELECT COUNT(*)::bigint FROM "Order" o WHERE o."restaurantId" = ${restaurantId}::uuid AND o.status = 'READY') AS "readyForServingOrders",
        ROUND(AVG(EXTRACT(EPOCH FROM (preparing_at - submitted_at)) / 60))::integer AS "averageQueueToPreparingMinutes",
        ROUND(AVG(EXTRACT(EPOCH FROM (ready_at - preparing_at)) / 60))::integer AS "averagePreparationMinutes",
        ROUND(AVG(EXTRACT(EPOCH FROM (ready_at - submitted_at)) / 60))::integer AS "averageTotalToReadyMinutes",
        COUNT(*)::bigint AS "completedItemSamples" FROM valid
    `;
    return first(rows, "kitchen summary");
  }
}
