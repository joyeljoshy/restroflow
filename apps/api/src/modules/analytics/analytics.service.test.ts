import { describe, expect, it } from "vitest";

import type {
  AnalyticsRepository,
  OverviewRow,
} from "./analytics.repository.js";
import { AnalyticsService } from "./analytics.service.js";

const context = { timezone: "Asia/Kolkata", currency: "INR" };
const overviewRow: OverviewRow = {
  finalizedSalesMinor: 30_000n,
  previousFinalizedSalesMinor: 20_000n,
  recordedPaymentsMinor: 12_000n,
  previousRecordedPaymentsMinor: 10_000n,
  currentOutstandingMinor: 18_000n,
  periodOutstandingMinor: 8_000n,
  finalizedBillCount: 2n,
  previousFinalizedBillCount: 1n,
  completedOrderCount: 4n,
  previousCompletedOrderCount: 2n,
  averageBillValueMinor: 15_000n,
  activeTableSessions: 3n,
  activeKitchenOrders: 2n,
};

function repository(
  overrides: Partial<AnalyticsRepository> = {},
): AnalyticsRepository {
  return {
    getContext: () => Promise.resolve(context),
    overview: () => Promise.resolve(overviewRow),
    sales: () => Promise.resolve([]),
    payments: () =>
      Promise.resolve({
        summary: {
          totalRecordedMinor: 0n,
          partiallyPaidBillCount: 0n,
          currentOutstandingMinor: 0n,
          periodOutstandingMinor: 0n,
        },
        methods: [],
        points: [],
      }),
    popularItems: () => Promise.resolve([]),
    orders: () =>
      Promise.resolve({
        summary: {
          ordersCreated: 0n,
          ordersServed: 0n,
          ordersCancelled: 0n,
          ordersRejected: 0n,
          waiterOrders: 0n,
          customerOrders: 0n,
          peakOrderingHour: null,
        },
        points: [],
      }),
    tables: () =>
      Promise.resolve({
        summary: {
          activeTables: 0n,
          currentlyOccupiedTables: 0n,
          completedSessions: 0n,
          averageOccupiedDurationMinutes: null,
        },
        usage: [],
      }),
    kitchen: () =>
      Promise.resolve({
        activePreparingOrders: 0n,
        readyForServingOrders: 0n,
        averageQueueToPreparingMinutes: null,
        averagePreparationMinutes: null,
        averageTotalToReadyMinutes: null,
        completedItemSamples: 0n,
      }),
    ...overrides,
  };
}

const range = {
  startDate: "2026-11-01",
  endDate: "2026-12-01",
  granularity: "day" as const,
};

describe("analytics service metric definitions", () => {
  it("keeps finalized sales, recorded payments, and balances distinct", async () => {
    const result = await new AnalyticsService(repository()).overview(
      "10000000-0000-4000-8000-000000000001",
      range,
    );

    expect(result.finalizedSales.value).toBe("30000");
    expect(result.recordedPayments.value).toBe("12000");
    expect(result.currentOutstandingMinor).toBe("18000");
    expect(result.periodOutstandingMinor).toBe("8000");
    expect(result.finalizedSales.changePercent).toBe(50);
    expect(result.context).toMatchObject({
      timezone: "Asia/Kolkata",
      endExclusive: true,
    });
  });

  it("serializes aggregate money without losing bigint precision", async () => {
    const result = await new AnalyticsService(
      repository({
        overview: () =>
          Promise.resolve({
            ...overviewRow,
            finalizedSalesMinor: 9_007_199_254_740_993n,
          }),
      }),
    ).overview("10000000-0000-4000-8000-000000000001", range);

    expect(result.finalizedSales.value).toBe("9007199254740993");
  });

  it("ranks item popularity against all billed quantity", async () => {
    const result = await new AnalyticsService(
      repository({
        popularItems: () =>
          Promise.resolve([
            {
              menuItemId: "10000000-0000-4000-8000-000000000002",
              itemName: "Archived special",
              quantitySold: 3n,
              salesContributionMinor: 45_000n,
              totalQuantity: 4n,
            },
          ]),
      }),
    ).popularItems("10000000-0000-4000-8000-000000000001", {
      ...range,
      limit: 5,
    });

    expect(result.items[0]).toMatchObject({
      itemName: "Archived special",
      popularityPercent: 75,
      salesContributionMinor: "45000",
    });
  });
});
