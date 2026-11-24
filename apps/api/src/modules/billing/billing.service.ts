import { createHash, randomUUID } from "node:crypto";

import {
  paymentResponseSchema,
  type ActiveBillingSession,
  type Bill,
  type BillListQuery,
  type BillPreview,
  type BillPreviewItem,
  type CreatePaymentRequest,
  type Payment,
} from "@restroflow/contracts";

import type { Prisma } from "../../generated/prisma/client.js";
import { AppError } from "../../errors/app-error.js";
import { unresolvedOrderStatuses } from "../orders/order.policy.js";
import type {
  BillingRepository,
  BillingSessionRecord,
  BillingTransactionOptions,
  BillItemCreate,
  BillRecord,
  PaymentIdempotencyRecord,
} from "./billing.repository.js";

const MAX_DATABASE_INTEGER = 2_147_483_647n;
export const BILL_ROUNDING_POLICY = "PER_LINE_HALF_UP_V1";
const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;
export const PAYMENT_TRANSACTION_OPTIONS = {
  maxWait: 10_000,
  timeout: 30_000,
  lockTimeoutMs: 5_000,
} satisfies BillingTransactionOptions;

export type BillChangeType = "FINALIZED" | "PAYMENT_RECORDED";

export interface BillingRealtimePublisher {
  billChanged(input: {
    restaurantId: string;
    billId: string;
    tableSessionId: string;
    billVersion: number;
    changeType: BillChangeType;
  }): Promise<void>;
}

export class NoopBillingRealtimePublisher implements BillingRealtimePublisher {
  billChanged(): Promise<void> {
    return Promise.resolve();
  }
}

export interface BillingServiceContract {
  listActiveSessions(restaurantId: string): Promise<ActiveBillingSession[]>;
  preview(restaurantId: string, tableSessionId: string): Promise<BillPreview>;
  finalize(
    restaurantId: string,
    membershipId: string,
    tableSessionId: string,
  ): Promise<Bill>;
  listBills(
    restaurantId: string,
    query: BillListQuery,
  ): Promise<{
    bills: Bill[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }>;
  getBill(restaurantId: string, billId: string): Promise<Bill>;
  getBillBySession(restaurantId: string, tableSessionId: string): Promise<Bill>;
  listPayments(restaurantId: string, billId: string): Promise<Payment[]>;
  recordPayment(
    restaurantId: string,
    membershipId: string,
    billId: string,
    idempotencyKey: string,
    input: CreatePaymentRequest,
  ): Promise<{ payment: Payment; bill: Bill }>;
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function errorCode(error: unknown): unknown {
  if (typeof error !== "object" || error === null || !("code" in error))
    return undefined;
  return error.code;
}

function property(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null || !(key in value))
    return undefined;
  return value[key as keyof typeof value];
}

function driverAdapterOriginalCode(error: unknown): unknown {
  return property(
    property(property(property(error, "meta"), "driverAdapterError"), "cause"),
    "originalCode",
  );
}

function isTransactionTimeoutError(error: unknown): boolean {
  return errorCode(error) === "P2028";
}

function isLockTimeoutError(error: unknown): boolean {
  if (errorCode(error) === "55P03") return true;
  if (errorCode(error) === "P2010")
    return (
      property(property(error, "meta"), "code") === "55P03" ||
      driverAdapterOriginalCode(error) === "55P03"
    );
  return (
    errorCode(error) === "P2039" && driverAdapterOriginalCode(error) === "55P03"
  );
}

function safeNumber(value: bigint, field: string): number {
  if (value < 0n || value > MAX_DATABASE_INTEGER)
    throw new AppError(
      422,
      "BILL_AMOUNT_OUT_OF_RANGE",
      `${field} exceeds the supported integer-money range.`,
    );
  return Number(value);
}

function roundHalfUp(numerator: bigint, denominator: bigint): bigint {
  return (numerator + denominator / 2n) / denominator;
}

export function calculateLineTax(
  lineSubtotalMinor: number,
  taxRateBasisPoints: number,
  pricesIncludeTax: boolean,
): number {
  const line = BigInt(lineSubtotalMinor);
  const rate = BigInt(taxRateBasisPoints);
  if (rate === 0n) return 0;
  const denominator = pricesIncludeTax ? 10_000n + rate : 10_000n;
  return safeNumber(roundHalfUp(line * rate, denominator), "Line tax");
}

function toPayment(record: BillRecord["payments"][number]): Payment {
  return {
    id: record.id,
    amountMinor: record.amountMinor,
    method: record.method,
    status: record.status,
    reference: record.reference,
    note: record.note,
    recordedBy: {
      id: record.recordedBy.id,
      displayName: record.recordedBy.user.displayName,
    },
    recordedAt: record.recordedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
  };
}

export function toBill(record: BillRecord): Bill {
  return {
    id: record.id,
    tableSessionId: record.tableSessionId,
    billNumber: record.billNumber,
    status: record.status,
    version: record.version,
    currency: record.currency,
    taxName: record.taxName,
    taxRateBasisPoints: record.taxRateBasisPoints,
    pricesIncludeTax: record.pricesIncludeTax,
    roundingPolicy: record.roundingPolicy,
    subtotalMinor: record.subtotalMinor,
    taxMinor: record.taxMinor,
    totalMinor: record.totalMinor,
    amountPaidMinor: record.amountPaidMinor,
    outstandingMinor: record.totalMinor - record.amountPaidMinor,
    restaurant: record.restaurant,
    table: record.tableSession.table,
    createdBy: {
      id: record.createdBy.id,
      displayName: record.createdBy.user.displayName,
    },
    finalizedBy: {
      id: record.finalizedBy.id,
      displayName: record.finalizedBy.user.displayName,
    },
    items: record.items.map((item) => ({
      id: item.id,
      sourceOrderItemId: item.sourceOrderItemId,
      orderNumberSnapshot: item.orderNumberSnapshot,
      itemNameSnapshot: item.itemNameSnapshot,
      quantity: item.quantity,
      unitPriceMinor: item.unitPriceMinor,
      modifierSubtotalMinor: item.modifierSubtotalMinor,
      lineSubtotalMinor: item.lineSubtotalMinor,
      taxAmountMinor: item.taxAmountMinor,
      finalLineAmountMinor: item.finalLineAmountMinor,
      batchNumber: item.batchNumber,
      modifiers: item.modifiers,
    })),
    payments: record.payments.map(toPayment),
    finalizedAt: record.finalizedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function restaurantIdentity(session: BillingSessionRecord) {
  return {
    id: session.restaurant.id,
    name: session.restaurant.name,
    address: session.restaurant.address,
    phone: session.restaurant.phone,
    email: session.restaurant.email,
  };
}

function calculateSession(session: BillingSessionRecord): {
  preview: BillPreview;
  items: BillItemCreate[];
} {
  const blockingOrderCount = session.orders.filter((order) =>
    unresolvedOrderStatuses.includes(order.status),
  ).length;
  const items: BillItemCreate[] = [];

  for (const order of session.orders) {
    if (order.status !== "SERVED") continue;
    for (const item of order.items) {
      if (item.status === "CANCELLED") continue;
      const modifierSubtotal = item.modifiers.reduce(
        (sum, modifier) =>
          sum + BigInt(modifier.modifierPriceMinor) * BigInt(modifier.quantity),
        0n,
      );
      const calculatedSubtotal =
        (BigInt(item.unitPriceMinor) + modifierSubtotal) *
        BigInt(item.quantity);
      const lineSubtotalMinor = safeNumber(calculatedSubtotal, "Line subtotal");
      if (lineSubtotalMinor !== item.lineTotalMinor)
        throw new AppError(
          409,
          "ORDER_SNAPSHOT_INCONSISTENT",
          "An order price snapshot is inconsistent and cannot be billed safely.",
        );
      const taxAmountMinor = calculateLineTax(
        lineSubtotalMinor,
        session.restaurant.taxRateBasisPoints,
        session.restaurant.pricesIncludeTax,
      );
      const finalLineAmountMinor = session.restaurant.pricesIncludeTax
        ? lineSubtotalMinor
        : safeNumber(
            BigInt(lineSubtotalMinor) + BigInt(taxAmountMinor),
            "Final line amount",
          );
      items.push({
        sourceOrderItemId: item.id,
        orderNumberSnapshot: order.orderNumber,
        itemNameSnapshot: item.itemNameSnapshot,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        modifierSubtotalMinor: safeNumber(
          modifierSubtotal,
          "Modifier subtotal",
        ),
        lineSubtotalMinor,
        taxAmountMinor,
        finalLineAmountMinor,
        batchNumber: item.batchNumber,
        modifiers: item.modifiers.map((modifier) => ({ ...modifier })),
      });
    }
  }

  const subtotalMinor = safeNumber(
    items.reduce((sum, item) => sum + BigInt(item.lineSubtotalMinor), 0n),
    "Bill subtotal",
  );
  const taxMinor = safeNumber(
    items.reduce((sum, item) => sum + BigInt(item.taxAmountMinor), 0n),
    "Bill tax",
  );
  const totalMinor = session.restaurant.pricesIncludeTax
    ? subtotalMinor
    : safeNumber(BigInt(subtotalMinor) + BigInt(taxMinor), "Bill total");
  const previewItems: BillPreviewItem[] = items.map((item) => ({
    ...item,
    modifiers: item.modifiers.map((modifier) => ({
      id: randomUUID(),
      ...modifier,
    })),
  }));

  return {
    items,
    preview: {
      tableSessionId: session.id,
      currency: session.restaurant.currency,
      taxName: session.restaurant.taxName,
      taxRateBasisPoints: session.restaurant.taxRateBasisPoints,
      pricesIncludeTax: session.restaurant.pricesIncludeTax,
      roundingPolicy: BILL_ROUNDING_POLICY,
      subtotalMinor,
      taxMinor,
      totalMinor,
      canFinalize: blockingOrderCount === 0 && items.length > 0,
      blockingOrderCount,
      restaurant: restaurantIdentity(session),
      table: session.table,
      items: previewItems,
    },
  };
}

function paymentRequestHash(billId: string, input: CreatePaymentRequest) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        billId,
        amountMinor: input.amountMinor,
        method: input.method,
        reference: input.reference ?? null,
        note: input.note ?? null,
        receivedExternally: input.receivedExternally,
      }),
    )
    .digest("hex");
}

function billNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  return `RF-${date}-${randomUUID().slice(0, 8).toUpperCase()}`;
}

export class BillingService implements BillingServiceContract {
  constructor(
    private readonly repository: BillingRepository,
    private readonly publisher: BillingRealtimePublisher = new NoopBillingRealtimePublisher(),
    private readonly paymentTransactionOptions: BillingTransactionOptions = PAYMENT_TRANSACTION_OPTIONS,
  ) {}

  async listActiveSessions(restaurantId: string) {
    return (await this.repository.listActiveSessions(restaurantId)).map(
      (session): ActiveBillingSession => ({
        tableSessionId: session.id,
        table: session.table,
        openedAt: session.openedAt.toISOString(),
        orderCount: session.orders.length,
        unresolvedOrderCount: session.orders.filter((order) =>
          unresolvedOrderStatuses.includes(order.status),
        ).length,
        billingStatus: session.bill?.status ?? "UNBILLED",
        billId: session.bill?.id ?? null,
        totalMinor: session.bill?.totalMinor ?? null,
        outstandingMinor: session.bill
          ? session.bill.totalMinor - session.bill.amountPaidMinor
          : null,
        currency: session.restaurant.currency,
      }),
    );
  }

  async preview(restaurantId: string, tableSessionId: string) {
    const session = await this.requireSession(restaurantId, tableSessionId);
    if (session.status !== "OPEN" || session.closedAt)
      throw new AppError(
        409,
        "TABLE_SESSION_CLOSED",
        "Closed table sessions cannot generate a new bill.",
      );
    if (session.bill)
      throw new AppError(
        409,
        "BILL_ALREADY_FINALIZED",
        "This table session already has a finalized bill.",
      );
    return calculateSession(session).preview;
  }

  async finalize(
    restaurantId: string,
    membershipId: string,
    tableSessionId: string,
  ) {
    let created: BillRecord;
    try {
      created = await this.repository.transaction(async (transaction) => {
        const session = await transaction.lockSession(
          restaurantId,
          tableSessionId,
        );
        if (!session)
          throw new AppError(
            404,
            "TABLE_SESSION_NOT_FOUND",
            "Table session not found.",
          );
        if (session.status !== "OPEN" || session.closedAt)
          throw new AppError(
            409,
            "TABLE_SESSION_CLOSED",
            "Closed table sessions cannot be billed.",
          );
        if (session.bill)
          throw new AppError(
            409,
            "BILL_ALREADY_FINALIZED",
            "This table session already has a finalized bill.",
          );
        const calculation = calculateSession(session);
        if (calculation.preview.blockingOrderCount > 0)
          throw new AppError(
            409,
            "BILL_HAS_UNRESOLVED_ORDERS",
            "Resolve every active order before finalizing the bill.",
          );
        if (calculation.items.length === 0)
          throw new AppError(
            409,
            "BILL_HAS_NO_ELIGIBLE_ITEMS",
            "There are no served items eligible for billing.",
          );
        return transaction.createBill({
          restaurantId,
          tableSessionId,
          billNumber: billNumber(),
          status: calculation.preview.totalMinor === 0 ? "PAID" : "FINALIZED",
          currency: calculation.preview.currency,
          taxName: calculation.preview.taxName,
          taxRateBasisPoints: calculation.preview.taxRateBasisPoints,
          pricesIncludeTax: calculation.preview.pricesIncludeTax,
          roundingPolicy: BILL_ROUNDING_POLICY,
          subtotalMinor: calculation.preview.subtotalMinor,
          taxMinor: calculation.preview.taxMinor,
          totalMinor: calculation.preview.totalMinor,
          membershipId,
          items: calculation.items,
        });
      });
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new AppError(
          409,
          "BILL_ALREADY_FINALIZED",
          "This table session already has a finalized bill.",
        );
      throw error;
    }
    await this.publisher.billChanged({
      restaurantId,
      billId: created.id,
      tableSessionId,
      billVersion: created.version,
      changeType: "FINALIZED",
    });
    return toBill(created);
  }

  async listBills(restaurantId: string, query: BillListQuery) {
    const { records, total } = await this.repository.listBills(
      restaurantId,
      query,
    );
    return {
      bills: records.map(toBill),
      pagination: {
        page: query.page,
        limit: query.limit,
        total,
        totalPages: total === 0 ? 0 : Math.ceil(total / query.limit),
      },
    };
  }

  async getBill(restaurantId: string, billId: string) {
    const bill = await this.repository.findBill(restaurantId, billId);
    if (!bill) throw new AppError(404, "BILL_NOT_FOUND", "Bill not found.");
    return toBill(bill);
  }

  async getBillBySession(restaurantId: string, tableSessionId: string) {
    const bill = await this.repository.findBillBySession(
      restaurantId,
      tableSessionId,
    );
    if (!bill) throw new AppError(404, "BILL_NOT_FOUND", "Bill not found.");
    return toBill(bill);
  }

  async listPayments(restaurantId: string, billId: string) {
    return (await this.requireBill(restaurantId, billId)).payments.map(
      toPayment,
    );
  }

  async recordPayment(
    restaurantId: string,
    membershipId: string,
    billId: string,
    idempotencyKey: string,
    input: CreatePaymentRequest,
  ) {
    const requestHash = paymentRequestHash(billId, input);
    const existing = await this.repository.findPaymentIdempotency(
      restaurantId,
      membershipId,
      idempotencyKey,
    );
    if (existing) return this.replayPayment(existing, requestHash);

    let result: { payment: Payment; bill: Bill };
    try {
      result = await this.repository.transaction(async (transaction) => {
        const inTransaction = await transaction.findPaymentIdempotency(
          restaurantId,
          membershipId,
          idempotencyKey,
        );
        if (inTransaction)
          return this.replayPayment(inTransaction, requestHash);
        await transaction.reservePaymentIdempotency({
          restaurantId,
          membershipId,
          billId,
          key: idempotencyKey,
          requestHash,
          expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
        });
        const current = await transaction.lockBill(restaurantId, billId);
        if (!current)
          throw new AppError(404, "BILL_NOT_FOUND", "Bill not found.");
        if (current.status === "PAID")
          throw new AppError(
            409,
            "BILL_ALREADY_PAID",
            "This bill is already fully paid.",
          );
        if (
          current.tableSession.status !== "OPEN" ||
          current.tableSession.closedAt
        )
          throw new AppError(
            409,
            "TABLE_SESSION_CLOSED",
            "Payments cannot be recorded after the table session closes.",
          );
        if (current.payments.length >= 100)
          throw new AppError(
            409,
            "PAYMENT_RECORD_LIMIT_REACHED",
            "This bill has reached the maximum number of payment records.",
          );
        const outstanding = current.totalMinor - current.amountPaidMinor;
        if (input.amountMinor > outstanding)
          throw new AppError(
            409,
            "PAYMENT_EXCEEDS_BALANCE",
            "The recorded payment cannot exceed the outstanding balance.",
            { outstandingMinor: outstanding },
          );
        const amountPaidMinor = current.amountPaidMinor + input.amountMinor;
        const status =
          amountPaidMinor === current.totalMinor ? "PAID" : "PARTIALLY_PAID";
        const created = await transaction.createPayment({
          restaurantId,
          billId,
          membershipId,
          payment: input,
          amountPaidMinor,
          status,
        });
        const payment = created.bill.payments.find(
          (candidate) => candidate.id === created.paymentId,
        );
        if (!payment)
          throw new AppError(
            500,
            "PAYMENT_RECORDING_FAILED",
            "The payment could not be recorded.",
          );
        const response = {
          payment: toPayment(payment),
          bill: toBill(created.bill),
        };
        await transaction.completePaymentIdempotency({
          restaurantId,
          membershipId,
          key: idempotencyKey,
          paymentId: created.paymentId,
          responseBody: JSON.parse(
            JSON.stringify(response),
          ) as Prisma.InputJsonValue,
        });
        return response;
      }, this.paymentTransactionOptions);
    } catch (error) {
      if (isUniqueConstraintError(error)) {
        const concurrent = await this.repository.findPaymentIdempotency(
          restaurantId,
          membershipId,
          idempotencyKey,
        );
        if (!concurrent) throw error;
        return this.replayPayment(concurrent, requestHash);
      }
      if (isLockTimeoutError(error))
        throw new AppError(
          503,
          "PAYMENT_BUSY",
          "Another payment is currently updating this bill. Retry with the same idempotency key.",
          { retryable: true },
        );
      if (isTransactionTimeoutError(error))
        throw new AppError(
          503,
          "PAYMENT_TRANSACTION_TIMEOUT",
          "The payment could not be completed within the transaction time limit. Retry with the same idempotency key.",
          { retryable: true },
        );
      throw error;
    }
    await this.publisher.billChanged({
      restaurantId,
      billId,
      tableSessionId: result.bill.tableSessionId,
      billVersion: result.bill.version,
      changeType: "PAYMENT_RECORDED",
    });
    return result;
  }

  private async requireSession(restaurantId: string, tableSessionId: string) {
    const session = await this.repository.findSession(
      restaurantId,
      tableSessionId,
    );
    if (!session)
      throw new AppError(
        404,
        "TABLE_SESSION_NOT_FOUND",
        "Table session not found.",
      );
    return session;
  }

  private async requireBill(restaurantId: string, billId: string) {
    const bill = await this.repository.findBill(restaurantId, billId);
    if (!bill) throw new AppError(404, "BILL_NOT_FOUND", "Bill not found.");
    return bill;
  }

  private replayPayment(
    record: PaymentIdempotencyRecord,
    requestHash: string,
  ): { payment: Payment; bill: Bill } {
    if (record.requestHash !== requestHash)
      throw new AppError(
        409,
        "IDEMPOTENCY_KEY_REUSED",
        "This idempotency key was already used with a different payment.",
      );
    if (!record.responseBody)
      throw new AppError(
        409,
        "PAYMENT_IN_PROGRESS",
        "The matching payment request is still being processed.",
      );
    return paymentResponseSchema.parse(record.responseBody);
  }
}
