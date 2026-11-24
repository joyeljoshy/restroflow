import { randomUUID } from "node:crypto";
import { arch, cpus, platform } from "node:os";
import { performance } from "node:perf_hooks";

import { requireBenchmarkDatabaseUrl } from "../../config/database-target.js";
import { createPrismaClient } from "../../lib/prisma.js";
import { PrismaAnalyticsRepository } from "./analytics.repository.js";

if (process.env.NODE_ENV === "production")
  throw new Error("Analytics benchmarks are disabled in production.");
const databaseUrl = requireBenchmarkDatabaseUrl(
  process.env.DATABASE_URL,
  process.env.ANALYTICS_BENCHMARK_ALLOW_REMOTE === "1",
);

const prisma = createPrismaClient(databaseUrl);
const repository = new PrismaAnalyticsRepository(prisma);
function boundedInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
) {
  if (value === undefined) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum)
    throw new Error(`Expected an integer between 1 and ${maximum}.`);
  return parsed;
}

const rowCount = boundedInteger(
  process.env.ANALYTICS_BENCHMARK_ROWS,
  1_000,
  50_000,
);
const sampleCount = boundedInteger(
  process.env.ANALYTICS_BENCHMARK_SAMPLES,
  5,
  30,
);
const suffix = randomUUID().slice(0, 8);
const restaurantId = randomUUID();
const userId = randomUUID();
const membershipId = randomUUID();
const tableId = randomUUID();
const categoryId = randomUUID();
const menuItemId = randomUUID();

type BenchmarkResult = {
  name: string;
  medianMs: number;
  p95Ms: number;
  samplesMs: number[];
};

async function measure(
  name: string,
  operation: () => Promise<unknown>,
): Promise<BenchmarkResult> {
  await operation();
  const samples: number[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const started = performance.now();
    await operation();
    samples.push(Number((performance.now() - started).toFixed(2)));
  }
  const sorted = [...samples].sort((left, right) => left - right);
  const medianIndex = Math.floor(sorted.length / 2);
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
  return {
    name,
    medianMs: sorted[medianIndex]!,
    p95Ms: sorted[p95Index]!,
    samplesMs: samples,
  };
}

async function insertBatches<T>(
  rows: T[],
  insert: (batch: T[]) => Promise<unknown>,
) {
  const batchSize = 1_000;
  for (let offset = 0; offset < rows.length; offset += batchSize)
    await insert(rows.slice(offset, offset + batchSize));
}

async function cleanup() {
  await prisma.billItemModifier.deleteMany({ where: { restaurantId } });
  await prisma.payment.deleteMany({ where: { restaurantId } });
  await prisma.billItem.deleteMany({ where: { restaurantId } });
  await prisma.bill.deleteMany({ where: { restaurantId } });
  await prisma.orderItemModifier.deleteMany({
    where: { orderItem: { restaurantId } },
  });
  await prisma.orderItemStatusHistory.deleteMany({ where: { restaurantId } });
  await prisma.orderStatusHistory.deleteMany({ where: { restaurantId } });
  await prisma.orderItem.deleteMany({ where: { restaurantId } });
  await prisma.order.deleteMany({ where: { restaurantId } });
  await prisma.tableSession.deleteMany({ where: { restaurantId } });
  await prisma.restaurantTable.deleteMany({ where: { restaurantId } });
  await prisma.menuItem.deleteMany({ where: { restaurantId } });
  await prisma.menuCategory.deleteMany({ where: { restaurantId } });
  await prisma.staffMembership.deleteMany({ where: { restaurantId } });
  await prisma.user.deleteMany({ where: { id: userId } });
  await prisma.restaurant.deleteMany({ where: { id: restaurantId } });
}

async function explainPopularItems(
  timezone: string,
  startDate: string,
  endDate: string,
) {
  const rows = await prisma.$queryRaw<Array<{ "QUERY PLAN": unknown }>>`
    EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
    WITH bounds AS (
      SELECT
        ((${startDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS start_utc,
        ((${endDate}::date::timestamp AT TIME ZONE ${timezone}) AT TIME ZONE 'UTC') AS end_utc
    ), eligible AS (
      SELECT bi.*, oi."menuItemId", b."finalizedAt"
      FROM "BillItem" bi
      JOIN "Bill" b ON b.id = bi."billId" AND b."restaurantId" = bi."restaurantId"
      JOIN "OrderItem" oi ON oi.id = bi."sourceOrderItemId" AND oi."restaurantId" = bi."restaurantId", bounds x
      WHERE bi."restaurantId" = ${restaurantId}::uuid
        AND b."finalizedAt" >= x.start_utc
        AND b."finalizedAt" < x.end_utc
    ), names AS (
      SELECT DISTINCT ON ("menuItemId") "menuItemId", "itemNameSnapshot"
      FROM eligible
      ORDER BY "menuItemId", "finalizedAt" DESC, id DESC
    )
    SELECT e."menuItemId", n."itemNameSnapshot",
      SUM(e.quantity)::bigint AS "quantitySold",
      SUM(e."finalLineAmountMinor")::bigint AS "salesContributionMinor",
      SUM(SUM(e.quantity)) OVER ()::bigint AS "totalQuantity"
    FROM eligible e
    JOIN names n ON n."menuItemId" = e."menuItemId"
    GROUP BY e."menuItemId", n."itemNameSnapshot"
    ORDER BY "quantitySold" DESC, "salesContributionMinor" DESC, e."menuItemId" ASC
    LIMIT 5
  `;
  const raw = rows[0]?.["QUERY PLAN"];
  const document =
    Array.isArray(raw) && typeof raw[0] === "object" && raw[0] !== null
      ? (raw[0] as Record<string, unknown>)
      : undefined;
  const root =
    document && typeof document.Plan === "object" && document.Plan !== null
      ? (document.Plan as Record<string, unknown>)
      : undefined;
  if (!document || !root) return null;
  const nodeTypes: Record<string, number> = {};
  const sequentialScans = new Set<string>();
  const indexes = new Set<string>();
  const visit = (node: Record<string, unknown>) => {
    const nodeType =
      typeof node["Node Type"] === "string" ? node["Node Type"] : "Unknown";
    nodeTypes[nodeType] = (nodeTypes[nodeType] ?? 0) + 1;
    if (nodeType === "Seq Scan" && typeof node["Relation Name"] === "string")
      sequentialScans.add(node["Relation Name"]);
    if (typeof node["Index Name"] === "string") indexes.add(node["Index Name"]);
    if (Array.isArray(node.Plans))
      for (const child of node.Plans)
        if (typeof child === "object" && child !== null)
          visit(child as Record<string, unknown>);
  };
  visit(root);
  return {
    planningTimeMs: document["Planning Time"],
    executionTimeMs: document["Execution Time"],
    rootNode: root["Node Type"],
    rootActualRows: root["Actual Rows"],
    sharedHitBlocks: root["Shared Hit Blocks"],
    tempReadBlocks: root["Temp Read Blocks"],
    tempWrittenBlocks: root["Temp Written Blocks"],
    nodeTypes,
    sequentialScans: [...sequentialScans],
    indexes: [...indexes],
  };
}

async function main() {
  const benchmarkStarted = performance.now();
  try {
    await prisma.restaurant.create({
      data: {
        id: restaurantId,
        name: `Analytics benchmark ${suffix}`,
        slug: `analytics-benchmark-${suffix}`,
        timezone: "Asia/Kolkata",
        currency: "INR",
      },
    });
    await prisma.user.create({
      data: {
        id: userId,
        email: `analytics-benchmark-${suffix}@example.test`,
        displayName: "Analytics Benchmark",
        passwordHash: "benchmark-only",
      },
    });
    await prisma.staffMembership.create({
      data: { id: membershipId, restaurantId, userId, role: "ADMIN" },
    });
    await prisma.restaurantTable.create({
      data: {
        id: tableId,
        restaurantId,
        tableNumber: `BENCH-${suffix}`,
        displayName: "Benchmark table",
        capacity: 4,
        qrIdentifier: randomUUID().replaceAll("-", ""),
      },
    });
    await prisma.menuCategory.create({
      data: {
        id: categoryId,
        restaurantId,
        name: `Benchmark category ${suffix}`,
      },
    });
    await prisma.menuItem.create({
      data: {
        id: menuItemId,
        restaurantId,
        categoryId,
        name: "Benchmark dish",
        priceMinor: 1_000,
      },
    });

    const rows = Array.from({ length: rowCount }, (_, index) => {
      const timestamp = new Date(Date.UTC(2026, 7, 1 + (index % 92), 12));
      return {
        ordinal: index,
        sessionId: randomUUID(),
        orderId: randomUUID(),
        itemId: randomUUID(),
        billId: randomUUID(),
        billItemId: randomUUID(),
        timestamp,
        totalMinor: 1_000 + (index % 20) * 100,
      };
    });

    await insertBatches(rows, (batch) =>
      prisma.tableSession.createMany({
        data: batch.map((row) => ({
          id: row.sessionId,
          restaurantId,
          tableId,
          status: "CLOSED",
          openedAt: new Date(row.timestamp.getTime() - 60 * 60 * 1000),
          closedAt: row.timestamp,
          openedByMembershipId: membershipId,
          closedByMembershipId: membershipId,
        })),
      }),
    );
    await insertBatches(rows, (batch) =>
      prisma.order.createMany({
        data: batch.map((row) => ({
          id: row.orderId,
          restaurantId,
          tableSessionId: row.sessionId,
          orderNumber: `BENCH-${row.ordinal}-${suffix}`,
          status: "SERVED",
          totalMinor: row.totalMinor,
          createdByMembershipId: membershipId,
          createdAt: new Date(row.timestamp.getTime() - 30 * 60 * 1000),
          updatedAt: row.timestamp,
        })),
      }),
    );
    await insertBatches(rows, (batch) =>
      prisma.orderItem.createMany({
        data: batch.map((row) => ({
          id: row.itemId,
          orderId: row.orderId,
          restaurantId,
          menuItemId,
          itemNameSnapshot: "Benchmark dish",
          quantity: 1,
          unitPriceMinor: row.totalMinor,
          lineTotalMinor: row.totalMinor,
          status: "SERVED",
          createdAt: new Date(row.timestamp.getTime() - 30 * 60 * 1000),
          updatedAt: row.timestamp,
        })),
      }),
    );
    await insertBatches(rows, (batch) =>
      prisma.orderStatusHistory.createMany({
        data: batch.map((row) => ({
          orderId: row.orderId,
          restaurantId,
          previousStatus: "READY" as const,
          newStatus: "SERVED" as const,
          actorMembershipId: membershipId,
          reason: "Benchmark completion",
          createdAt: row.timestamp,
        })),
      }),
    );
    await insertBatches(
      rows.flatMap((row) => [
        {
          orderItemId: row.itemId,
          restaurantId,
          previousStatus: null,
          newStatus: "PENDING" as const,
          actorMembershipId: membershipId,
          createdAt: new Date(row.timestamp.getTime() - 30 * 60 * 1000),
        },
        {
          orderItemId: row.itemId,
          restaurantId,
          previousStatus: "PENDING" as const,
          newStatus: "PREPARING" as const,
          actorMembershipId: membershipId,
          createdAt: new Date(row.timestamp.getTime() - 15 * 60 * 1000),
        },
        {
          orderItemId: row.itemId,
          restaurantId,
          previousStatus: "PREPARING" as const,
          newStatus: "READY" as const,
          actorMembershipId: membershipId,
          createdAt: new Date(row.timestamp.getTime() - 5 * 60 * 1000),
        },
      ]),
      (batch) => prisma.orderItemStatusHistory.createMany({ data: batch }),
    );
    const modifiedRows = rows.filter((_, index) => index % 3 === 0);
    await insertBatches(modifiedRows, (batch) =>
      prisma.orderItemModifier.createMany({
        data: batch.map((row) => ({
          orderItemId: row.itemId,
          modifierGroupNameSnapshot: "Benchmark options",
          modifierNameSnapshot: "Benchmark extra",
          modifierPriceMinor: 0,
          quantity: 1,
        })),
      }),
    );
    await insertBatches(rows, (batch) =>
      prisma.bill.createMany({
        data: batch.map((row) => ({
          id: row.billId,
          restaurantId,
          tableSessionId: row.sessionId,
          billNumber: `BENCH-${row.ordinal}-${suffix}`,
          status: "PAID",
          currency: "INR",
          taxName: "Tax",
          taxRateBasisPoints: 0,
          pricesIncludeTax: false,
          roundingPolicy: "PER_LINE_HALF_UP_V1",
          subtotalMinor: row.totalMinor,
          taxMinor: 0,
          totalMinor: row.totalMinor,
          amountPaidMinor: row.totalMinor,
          createdByMembershipId: membershipId,
          finalizedByMembershipId: membershipId,
          finalizedAt: row.timestamp,
          createdAt: row.timestamp,
          updatedAt: row.timestamp,
        })),
      }),
    );
    await insertBatches(rows, (batch) =>
      prisma.billItem.createMany({
        data: batch.map((row) => ({
          id: row.billItemId,
          restaurantId,
          billId: row.billId,
          sourceOrderItemId: row.itemId,
          orderNumberSnapshot: `BENCH-${row.ordinal}-${suffix}`,
          itemNameSnapshot: "Benchmark dish",
          quantity: 1,
          unitPriceMinor: row.totalMinor,
          modifierSubtotalMinor: 0,
          lineSubtotalMinor: row.totalMinor,
          taxAmountMinor: 0,
          finalLineAmountMinor: row.totalMinor,
          batchNumber: 1,
          createdAt: row.timestamp,
        })),
      }),
    );
    await insertBatches(modifiedRows, (batch) =>
      prisma.billItemModifier.createMany({
        data: batch.map((row) => ({
          restaurantId,
          billItemId: row.billItemId,
          modifierGroupNameSnapshot: "Benchmark options",
          modifierNameSnapshot: "Benchmark extra",
          modifierPriceMinor: 0,
          quantity: 1,
          createdAt: row.timestamp,
        })),
      }),
    );
    await insertBatches(rows, (batch) =>
      prisma.payment.createMany({
        data: batch.map((row, index) => ({
          restaurantId,
          billId: row.billId,
          amountMinor: row.totalMinor,
          method: index % 2 === 0 ? ("CASH" as const) : ("UPI" as const),
          recordedByMembershipId: membershipId,
          recordedAt: row.timestamp,
          createdAt: row.timestamp,
        })),
      }),
    );

    // The fixture is inserted immediately before measurement, so autovacuum
    // has not had time to update planner statistics. Without this, PostgreSQL
    // can estimate one row and choose quadratic nested-loop joins that do not
    // represent a warmed production database.
    await prisma.$executeRawUnsafe(
      'ANALYZE "Bill", "BillItem", "OrderItem", "Payment", "Order", "OrderStatusHistory", "TableSession"',
    );

    const timezone = "Asia/Kolkata";
    const start = "2026-08-01";
    const end = "2026-11-01";
    const [database] = await prisma.$queryRaw<{ version: string }[]>`
      SELECT version() AS version
    `;
    const results = await Promise.all([
      measure("overview", () =>
        repository.overview(
          restaurantId,
          timezone,
          start,
          end,
          "2026-05-01",
          start,
        ),
      ),
      measure("sales", () =>
        repository.sales(restaurantId, timezone, start, end, "day"),
      ),
      measure("popular-items", () =>
        repository.popularItems(restaurantId, timezone, start, end, 5),
      ),
      measure("payments", () =>
        repository.payments(restaurantId, timezone, start, end, "day"),
      ),
    ]);
    const popularItemsPlan =
      process.env.ANALYTICS_BENCHMARK_EXPLAIN === "1"
        ? await explainPopularItems(timezone, start, end)
        : undefined;
    console.log(
      JSON.stringify(
        {
          generatedRows: rowCount,
          relatedRows: {
            orderItems: rowCount,
            itemStatusHistories: rowCount * 3,
            orderStatusHistories: rowCount,
            modifiers: modifiedRows.length,
            bills: rowCount,
            payments: rowCount,
          },
          range: { start, end, timezone, endExclusive: true },
          environment: {
            node: process.version,
            platform: platform(),
            architecture: arch(),
            cpuModel: cpus()[0]?.model ?? "unknown",
            logicalCpuCount: cpus().length,
            database: database?.version ?? "unknown",
            queryConcurrency: 4,
            samplesPerQuery: sampleCount,
            plannerStatisticsRefreshed: true,
            totalDurationMs: Number(
              (performance.now() - benchmarkStarted).toFixed(2),
            ),
          },
          results,
          ...(popularItemsPlan === undefined ? {} : { popularItemsPlan }),
        },
        null,
        2,
      ),
    );
  } finally {
    await cleanup();
    await prisma.$disconnect();
  }
}

await main();
