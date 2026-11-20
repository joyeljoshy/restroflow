import type {
  AnalyticsContext,
  AnalyticsOverview,
  AnalyticsRangeQuery,
  KitchenAnalytics,
  OrderAnalytics,
  PaymentAnalytics,
  PopularItemsAnalytics,
  PopularItemsQuery,
  SalesAnalytics,
  TableAnalytics,
} from "@restroflow/contracts";

import { AppError } from "../../errors/app-error.js";
import type { AnalyticsRepository } from "./analytics.repository.js";

const MAX_SAFE_COUNT = BigInt(Number.MAX_SAFE_INTEGER);

function money(value: bigint): string {
  if (value < 0n)
    throw new AppError(
      500,
      "ANALYTICS_INVARIANT_VIOLATION",
      "An analytics money aggregate was negative.",
    );
  return value.toString();
}

function safeCount(value: bigint): number {
  if (value < 0n || value > MAX_SAFE_COUNT)
    throw new AppError(
      500,
      "ANALYTICS_COUNT_OUT_OF_RANGE",
      "An analytics count exceeds the supported response range.",
    );
  return Number(value);
}

function percentageChange(current: bigint, previous: bigint): number | null {
  if (previous === 0n) return null;
  return Number(((current - previous) * 10_000n) / previous) / 100;
}

function popularity(value: bigint, total: bigint): number {
  if (total === 0n) return 0;
  return Number((value * 10_000n) / total) / 100;
}

function shiftDate(localDate: string, days: number): string {
  const value = new Date(`${localDate}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function daysBetween(startDate: string, endDate: string): number {
  return Math.round(
    (Date.parse(`${endDate}T00:00:00.000Z`) -
      Date.parse(`${startDate}T00:00:00.000Z`)) /
      86_400_000,
  );
}

export interface AnalyticsServiceContract {
  overview(
    restaurantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<AnalyticsOverview>;
  sales(
    restaurantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<SalesAnalytics>;
  payments(
    restaurantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<PaymentAnalytics>;
  popularItems(
    restaurantId: string,
    query: PopularItemsQuery,
  ): Promise<PopularItemsAnalytics>;
  orders(
    restaurantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<OrderAnalytics>;
  tables(
    restaurantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<TableAnalytics>;
  kitchen(
    restaurantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<KitchenAnalytics>;
}

export class AnalyticsService implements AnalyticsServiceContract {
  constructor(private readonly repository: AnalyticsRepository) {}

  private async context(
    restaurantId: string,
    query: AnalyticsRangeQuery,
  ): Promise<AnalyticsContext> {
    const restaurant = await this.repository.getContext(restaurantId);
    if (!restaurant)
      throw new AppError(404, "RESTAURANT_NOT_FOUND", "Restaurant not found.");
    return {
      ...query,
      timezone: restaurant.timezone,
      currency: restaurant.currency,
      endExclusive: true,
    };
  }

  async overview(restaurantId: string, query: AnalyticsRangeQuery) {
    const context = await this.context(restaurantId, query);
    const span = daysBetween(query.startDate, query.endDate);
    const previousStart = shiftDate(query.startDate, -span);
    const row = await this.repository.overview(
      restaurantId,
      context.timezone,
      query.startDate,
      query.endDate,
      previousStart,
      query.startDate,
    );
    return {
      context,
      finalizedSales: {
        value: money(row.finalizedSalesMinor),
        previousValue: money(row.previousFinalizedSalesMinor),
        changePercent: percentageChange(
          row.finalizedSalesMinor,
          row.previousFinalizedSalesMinor,
        ),
      },
      recordedPayments: {
        value: money(row.recordedPaymentsMinor),
        previousValue: money(row.previousRecordedPaymentsMinor),
        changePercent: percentageChange(
          row.recordedPaymentsMinor,
          row.previousRecordedPaymentsMinor,
        ),
      },
      currentOutstandingMinor: money(row.currentOutstandingMinor),
      periodOutstandingMinor: money(row.periodOutstandingMinor),
      finalizedBillCount: {
        value: safeCount(row.finalizedBillCount),
        previousValue: safeCount(row.previousFinalizedBillCount),
        changePercent: percentageChange(
          row.finalizedBillCount,
          row.previousFinalizedBillCount,
        ),
      },
      completedOrderCount: {
        value: safeCount(row.completedOrderCount),
        previousValue: safeCount(row.previousCompletedOrderCount),
        changePercent: percentageChange(
          row.completedOrderCount,
          row.previousCompletedOrderCount,
        ),
      },
      averageBillValueMinor: money(row.averageBillValueMinor),
      activeTableSessions: safeCount(row.activeTableSessions),
      activeKitchenOrders: safeCount(row.activeKitchenOrders),
    } satisfies AnalyticsOverview;
  }

  async sales(restaurantId: string, query: AnalyticsRangeQuery) {
    const context = await this.context(restaurantId, query);
    const rows = await this.repository.sales(
      restaurantId,
      context.timezone,
      query.startDate,
      query.endDate,
      query.granularity,
    );
    return {
      context,
      points: rows.map((row) => ({
        period: row.period,
        amountMinor: money(row.amountMinor),
        count: safeCount(row.count),
      })),
    } satisfies SalesAnalytics;
  }

  async payments(restaurantId: string, query: AnalyticsRangeQuery) {
    const context = await this.context(restaurantId, query);
    const result = await this.repository.payments(
      restaurantId,
      context.timezone,
      query.startDate,
      query.endDate,
      query.granularity,
    );
    return {
      context,
      totalRecordedMinor: money(result.summary.totalRecordedMinor),
      methods: result.methods.map((row) => ({
        method: row.method,
        amountMinor: money(row.amountMinor),
        paymentCount: safeCount(row.paymentCount),
      })),
      points: result.points.map((row) => ({
        period: row.period,
        amountMinor: money(row.amountMinor),
        count: safeCount(row.count),
      })),
      partiallyPaidBillCount: safeCount(result.summary.partiallyPaidBillCount),
      currentOutstandingMinor: money(result.summary.currentOutstandingMinor),
      periodOutstandingMinor: money(result.summary.periodOutstandingMinor),
    } satisfies PaymentAnalytics;
  }

  async popularItems(restaurantId: string, query: PopularItemsQuery) {
    const context = await this.context(restaurantId, query);
    const rows = await this.repository.popularItems(
      restaurantId,
      context.timezone,
      query.startDate,
      query.endDate,
      query.limit,
    );
    return {
      context,
      items: rows.map((row) => ({
        menuItemId: row.menuItemId,
        itemName: row.itemName,
        quantitySold: safeCount(row.quantitySold),
        salesContributionMinor: money(row.salesContributionMinor),
        popularityPercent: popularity(row.quantitySold, row.totalQuantity),
      })),
    } satisfies PopularItemsAnalytics;
  }

  async orders(restaurantId: string, query: AnalyticsRangeQuery) {
    const context = await this.context(restaurantId, query);
    const result = await this.repository.orders(
      restaurantId,
      context.timezone,
      query.startDate,
      query.endDate,
      query.granularity,
    );
    return {
      context,
      ordersCreated: safeCount(result.summary.ordersCreated),
      ordersServed: safeCount(result.summary.ordersServed),
      ordersCancelled: safeCount(result.summary.ordersCancelled),
      ordersRejected: safeCount(result.summary.ordersRejected),
      sourceBreakdown: {
        waiter: safeCount(result.summary.waiterOrders),
        customer: safeCount(result.summary.customerOrders),
      },
      peakOrderingHour: result.summary.peakOrderingHour,
      points: result.points.map((row) => ({
        period: row.period,
        created: safeCount(row.created),
      })),
    } satisfies OrderAnalytics;
  }

  async tables(restaurantId: string, query: AnalyticsRangeQuery) {
    const context = await this.context(restaurantId, query);
    const result = await this.repository.tables(
      restaurantId,
      context.timezone,
      query.startDate,
      query.endDate,
    );
    const active = safeCount(result.summary.activeTables);
    const occupied = safeCount(result.summary.currentlyOccupiedTables);
    return {
      context,
      activeTables: active,
      currentlyOccupiedTables: occupied,
      availableTables: Math.max(0, active - occupied),
      completedSessions: safeCount(result.summary.completedSessions),
      averageOccupiedDurationMinutes:
        result.summary.averageOccupiedDurationMinutes,
      usage: result.usage.map((row) => ({
        tableId: row.tableId,
        displayName: row.displayName,
        completedSessions: safeCount(row.completedSessions),
      })),
    } satisfies TableAnalytics;
  }

  async kitchen(restaurantId: string, query: AnalyticsRangeQuery) {
    const context = await this.context(restaurantId, query);
    const row = await this.repository.kitchen(
      restaurantId,
      context.timezone,
      query.startDate,
      query.endDate,
    );
    return {
      context,
      activePreparingOrders: safeCount(row.activePreparingOrders),
      readyForServingOrders: safeCount(row.readyForServingOrders),
      averageQueueToPreparingMinutes: row.averageQueueToPreparingMinutes,
      averagePreparationMinutes: row.averagePreparationMinutes,
      averageTotalToReadyMinutes: row.averageTotalToReadyMinutes,
      completedItemSamples: safeCount(row.completedItemSamples),
    } satisfies KitchenAnalytics;
  }
}
