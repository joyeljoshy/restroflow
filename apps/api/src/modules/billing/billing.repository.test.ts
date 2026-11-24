import { describe, expect, it, vi } from "vitest";

import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";
import { PrismaBillingRepository } from "./billing.repository.js";

describe("PrismaBillingRepository transaction options", () => {
  it("applies a transaction-local lock timeout and forwards Prisma bounds", async () => {
    const queryRaw = vi.fn().mockResolvedValue([{ lockTimeout: "5000ms" }]);
    const transactionClient = {
      $queryRaw: queryRaw,
    } as unknown as Prisma.TransactionClient;
    const transaction = vi.fn(
      async (
        ...args: [
          (client: Prisma.TransactionClient) => Promise<unknown>,
          { maxWait?: number; timeout?: number }?,
        ]
      ) => args[0](transactionClient),
    );
    const repository = new PrismaBillingRepository({
      $transaction: transaction,
    } as unknown as PrismaClient);

    await expect(
      repository.transaction(() => Promise.resolve("completed"), {
        maxWait: 10_000,
        timeout: 30_000,
        lockTimeoutMs: 5_000,
      }),
    ).resolves.toBe("completed");

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), {
      maxWait: 10_000,
      timeout: 30_000,
    });
    expect(queryRaw).toHaveBeenCalledOnce();
    expect(queryRaw.mock.calls[0]?.[1]).toBe("5000ms");
  });

  it("does not change transaction settings when no options are supplied", async () => {
    const queryRaw = vi.fn();
    const transactionClient = {
      $queryRaw: queryRaw,
    } as unknown as Prisma.TransactionClient;
    const transaction = vi.fn(
      async (
        ...args: [
          (client: Prisma.TransactionClient) => Promise<unknown>,
          { maxWait?: number; timeout?: number }?,
        ]
      ) => args[0](transactionClient),
    );
    const repository = new PrismaBillingRepository({
      $transaction: transaction,
    } as unknown as PrismaClient);

    await repository.transaction(() => Promise.resolve());

    expect(transaction).toHaveBeenCalledWith(expect.any(Function), undefined);
    expect(queryRaw).not.toHaveBeenCalled();
  });
});
