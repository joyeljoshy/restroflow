import { describe, expect, it } from "vitest";

import type {
  BillingRepository,
  BillingTransactionOptions,
} from "./billing.repository.js";
import {
  BILL_ROUNDING_POLICY,
  BillingService,
  calculateLineTax,
  PAYMENT_TRANSACTION_OPTIONS,
} from "./billing.service.js";

const paymentInput = {
  amountMinor: 1_000,
  method: "CASH",
  receivedExternally: true,
} as const;

function failingRepository(
  error: Error,
  captureOptions?: (options: BillingTransactionOptions | undefined) => void,
): BillingRepository {
  return {
    transaction: <T>(_work: unknown, options?: BillingTransactionOptions) => {
      captureOptions?.(options);
      return Promise.reject<T>(error);
    },
    findSession: () => Promise.resolve(null),
    listActiveSessions: () => Promise.resolve([]),
    findBill: () => Promise.resolve(null),
    findBillBySession: () => Promise.resolve(null),
    listBills: () => Promise.resolve({ records: [], total: 0 }),
    findPaymentIdempotency: () => Promise.resolve(null),
  };
}

function codedError(code: string, meta?: unknown): Error {
  return Object.assign(new Error("Test database error"), {
    code,
    ...(meta ? { meta } : {}),
  });
}

describe("billing money policy", () => {
  it("rounds exclusive tax half-up per line using basis points", () => {
    expect(calculateLineTax(27_000, 500, false)).toBe(1_350);
    expect(calculateLineTax(10, 500, false)).toBe(1);
    expect(calculateLineTax(9, 500, false)).toBe(0);
    expect(BILL_ROUNDING_POLICY).toBe("PER_LINE_HALF_UP_V1");
  });

  it("extracts included tax without increasing the payable line", () => {
    expect(calculateLineTax(10_500, 500, true)).toBe(500);
    expect(calculateLineTax(0, 500, true)).toBe(0);
    expect(calculateLineTax(10_000, 0, false)).toBe(0);
  });
});

describe("payment transaction reliability", () => {
  it("uses explicit payment-only transaction bounds and maps Prisma expiry", async () => {
    let receivedOptions: BillingTransactionOptions | undefined;
    const service = new BillingService(
      failingRepository(codedError("P2028"), (options) => {
        receivedOptions = options;
      }),
    );

    const result = service.recordPayment(
      "restaurant-id",
      "membership-id",
      "bill-id",
      "payment-key",
      paymentInput,
    );

    await expect(result).rejects.toMatchObject({
      statusCode: 503,
      code: "PAYMENT_TRANSACTION_TIMEOUT",
      details: { retryable: true },
    });
    expect(receivedOptions).toEqual(PAYMENT_TRANSACTION_OPTIONS);
  });

  it.each([
    codedError("55P03"),
    codedError("P2010", { code: "55P03" }),
    codedError("P2010", {
      driverAdapterError: { cause: { originalCode: "55P03" } },
    }),
    codedError("P2039", {
      driverAdapterError: { cause: { originalCode: "55P03" } },
    }),
  ])("maps PostgreSQL lock timeout %# to a retryable error", async (error) => {
    const service = new BillingService(failingRepository(error));

    await expect(
      service.recordPayment(
        "restaurant-id",
        "membership-id",
        "bill-id",
        "payment-key",
        paymentInput,
      ),
    ).rejects.toMatchObject({
      statusCode: 503,
      code: "PAYMENT_BUSY",
      details: { retryable: true },
    });
  });

  it.each([
    codedError("P2039", {
      driverAdapterError: { cause: { originalCode: "23505" } },
    }),
    codedError("P2039"),
    codedError("P2039", { driverAdapterError: {} }),
    codedError("P2039", {
      driverAdapterError: { cause: { originalCode: 55_003 } },
    }),
    codedError("P2003", {
      driverAdapterError: { cause: { originalCode: "55P03" } },
    }),
  ])(
    "does not map unrelated or malformed Prisma error %# as lock contention",
    async (error) => {
      const service = new BillingService(failingRepository(error));

      await expect(
        service.recordPayment(
          "restaurant-id",
          "membership-id",
          "bill-id",
          "payment-key",
          paymentInput,
        ),
      ).rejects.toBe(error);
    },
  );
});
