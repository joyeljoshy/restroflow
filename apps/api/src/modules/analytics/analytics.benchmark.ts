import "dotenv/config";

import { randomUUID } from "node:crypto";
import { performance } from "node:perf_hooks";

import { createPrismaClient } from "../../lib/prisma.js";
import { PrismaAnalyticsRepository } from "./analytics.repository.js";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl)
  throw new Error("DATABASE_URL is required for the benchmark.");

const prisma = createPrismaClient(databaseUrl);
const repository = new PrismaAnalyticsRepository(prisma);
const rowCount = 500;
const suffix = randomUUID().slice(0, 8);
const restaurantId = randomUUID();
const userId = randomUUID();
const membershipId = randomUUID();
const tableId = randomUUID();
const categoryId = randomUUID();
const menuItemId = randomUUID();

type BenchmarkResult = { name: string; medianMs: number; samplesMs: number[] };

async function measure(
  name: string,
  operation: () => Promise<unknown>,
): Promise<BenchmarkResult> {
  await operation();
  const samples: number[] = [];
  for (let index = 0; index < 5; index += 1) {
    const started = performance.now();
    await operation();
    samples.push(Number((performance.now() - started).toFixed(2)));
  }
  const sorted = [...samples].sort((left, right) => left - right);
  return { name, medianMs: sorted[2]!, samplesMs: samples };
}

async function cleanup() {
  await prisma.payment.deleteMany({ where: { restaurantId } });
  await prisma.billItem.deleteMany({ where: { restaurantId } });
  await prisma.bill.deleteMany({ where: { restaurantId } });
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

async function main() {
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
      const timestamp = new Date(
        Date.UTC(2026, 7 + Math.floor(index / 170), 1 + (index % 28), 12),
      );
      return {
        sessionId: randomUUID(),
        orderId: randomUUID(),
        itemId: randomUUID(),
        billId: randomUUID(),
        timestamp,
        totalMinor: 1_000 + (index % 20) * 100,
      };
    });

    await prisma.tableSession.createMany({
      data: rows.map((row) => ({
        id: row.sessionId,
        restaurantId,
        tableId,
        status: "CLOSED",
        openedAt: new Date(row.timestamp.getTime() - 60 * 60 * 1000),
        closedAt: row.timestamp,
        openedByMembershipId: membershipId,
        closedByMembershipId: membershipId,
      })),
    });
    await prisma.order.createMany({
      data: rows.map((row, index) => ({
        id: row.orderId,
        restaurantId,
        tableSessionId: row.sessionId,
        orderNumber: `BENCH-${index}-${suffix}`,
        status: "SERVED",
        totalMinor: row.totalMinor,
        createdByMembershipId: membershipId,
        createdAt: row.timestamp,
      })),
    });
    await prisma.orderItem.createMany({
      data: rows.map((row) => ({
        id: row.itemId,
        orderId: row.orderId,
        restaurantId,
        menuItemId,
        itemNameSnapshot: "Benchmark dish",
        quantity: 1,
        unitPriceMinor: row.totalMinor,
        lineTotalMinor: row.totalMinor,
        status: "SERVED",
        createdAt: row.timestamp,
      })),
    });
    await prisma.bill.createMany({
      data: rows.map((row, index) => ({
        id: row.billId,
        restaurantId,
        tableSessionId: row.sessionId,
        billNumber: `BENCH-${index}-${suffix}`,
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
      })),
    });
    await prisma.billItem.createMany({
      data: rows.map((row, index) => ({
        restaurantId,
        billId: row.billId,
        sourceOrderItemId: row.itemId,
        orderNumberSnapshot: `BENCH-${index}-${suffix}`,
        itemNameSnapshot: "Benchmark dish",
        quantity: 1,
        unitPriceMinor: row.totalMinor,
        modifierSubtotalMinor: 0,
        lineSubtotalMinor: row.totalMinor,
        taxAmountMinor: 0,
        finalLineAmountMinor: row.totalMinor,
        batchNumber: 1,
      })),
    });
    await prisma.payment.createMany({
      data: rows.map((row, index) => ({
        restaurantId,
        billId: row.billId,
        amountMinor: row.totalMinor,
        method: index % 2 === 0 ? ("CASH" as const) : ("UPI" as const),
        recordedByMembershipId: membershipId,
        recordedAt: row.timestamp,
      })),
    });

    const timezone = "Asia/Kolkata";
    const start = "2026-08-01";
    const end = "2026-11-01";
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
    console.log(
      JSON.stringify(
        {
          generatedRows: rowCount,
          range: { start, end, timezone, endExclusive: true },
          results,
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
