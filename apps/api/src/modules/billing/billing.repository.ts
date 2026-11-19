import type {
  BillListQuery,
  BillStatus,
  CreatePaymentRequest,
  OrderItemStatus,
  OrderStatus,
} from "@restroflow/contracts";

import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

const actorSelection = {
  id: true,
  user: { select: { displayName: true } },
} satisfies Prisma.StaffMembershipSelect;

const billSelection = {
  id: true,
  restaurantId: true,
  tableSessionId: true,
  billNumber: true,
  status: true,
  version: true,
  currency: true,
  taxName: true,
  taxRateBasisPoints: true,
  pricesIncludeTax: true,
  roundingPolicy: true,
  subtotalMinor: true,
  taxMinor: true,
  totalMinor: true,
  amountPaidMinor: true,
  finalizedAt: true,
  createdAt: true,
  updatedAt: true,
  restaurant: {
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      email: true,
    },
  },
  tableSession: {
    select: {
      status: true,
      closedAt: true,
      table: {
        select: {
          id: true,
          tableNumber: true,
          displayName: true,
        },
      },
    },
  },
  createdBy: { select: actorSelection },
  finalizedBy: { select: actorSelection },
  items: {
    select: {
      id: true,
      sourceOrderItemId: true,
      orderNumberSnapshot: true,
      itemNameSnapshot: true,
      quantity: true,
      unitPriceMinor: true,
      modifierSubtotalMinor: true,
      lineSubtotalMinor: true,
      taxAmountMinor: true,
      finalLineAmountMinor: true,
      batchNumber: true,
      modifiers: {
        select: {
          id: true,
          modifierGroupNameSnapshot: true,
          modifierNameSnapshot: true,
          modifierPriceMinor: true,
          quantity: true,
        },
        orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
      },
    },
    orderBy: [
      { batchNumber: "asc" as const },
      { createdAt: "asc" as const },
      { id: "asc" as const },
    ],
  },
  payments: {
    select: {
      id: true,
      amountMinor: true,
      method: true,
      status: true,
      reference: true,
      note: true,
      recordedAt: true,
      createdAt: true,
      recordedBy: { select: actorSelection },
    },
    orderBy: [{ recordedAt: "asc" as const }, { id: "asc" as const }],
    take: 100,
  },
} satisfies Prisma.BillSelect;

export type BillRecord = Prisma.BillGetPayload<{
  select: typeof billSelection;
}>;

const sessionSelection = {
  id: true,
  restaurantId: true,
  status: true,
  closedAt: true,
  openedAt: true,
  table: {
    select: { id: true, tableNumber: true, displayName: true },
  },
  restaurant: {
    select: {
      id: true,
      name: true,
      address: true,
      phone: true,
      email: true,
      currency: true,
      taxName: true,
      taxRateBasisPoints: true,
      pricesIncludeTax: true,
    },
  },
  orders: {
    select: {
      id: true,
      orderNumber: true,
      status: true,
      items: {
        select: {
          id: true,
          restaurantId: true,
          itemNameSnapshot: true,
          quantity: true,
          unitPriceMinor: true,
          lineTotalMinor: true,
          status: true,
          batchNumber: true,
          modifiers: {
            select: {
              modifierGroupNameSnapshot: true,
              modifierNameSnapshot: true,
              modifierPriceMinor: true,
              quantity: true,
            },
            orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
          },
        },
        orderBy: [
          { batchNumber: "asc" as const },
          { createdAt: "asc" as const },
          { id: "asc" as const },
        ],
      },
    },
    orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }],
  },
  bill: { select: { id: true } },
} satisfies Prisma.TableSessionSelect;

export type BillingSessionRecord = Prisma.TableSessionGetPayload<{
  select: typeof sessionSelection;
}>;

export type ActiveSessionRecord = {
  id: string;
  openedAt: Date;
  table: { id: string; tableNumber: string; displayName: string };
  restaurant: { currency: string };
  orders: { status: OrderStatus }[];
  bill: {
    id: string;
    status: BillStatus;
    totalMinor: number;
    amountPaidMinor: number;
  } | null;
};

export type PaymentIdempotencyRecord = {
  requestHash: string;
  responseBody: Prisma.JsonValue | null;
};

export type BillItemCreate = {
  sourceOrderItemId: string;
  orderNumberSnapshot: string;
  itemNameSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  modifierSubtotalMinor: number;
  lineSubtotalMinor: number;
  taxAmountMinor: number;
  finalLineAmountMinor: number;
  batchNumber: number;
  modifiers: {
    modifierGroupNameSnapshot: string;
    modifierNameSnapshot: string;
    modifierPriceMinor: number;
    quantity: number;
  }[];
};

export interface BillingTransaction {
  lockSession(
    restaurantId: string,
    tableSessionId: string,
  ): Promise<BillingSessionRecord | null>;
  createBill(input: {
    restaurantId: string;
    tableSessionId: string;
    billNumber: string;
    status: BillStatus;
    currency: string;
    taxName: string;
    taxRateBasisPoints: number;
    pricesIncludeTax: boolean;
    roundingPolicy: string;
    subtotalMinor: number;
    taxMinor: number;
    totalMinor: number;
    membershipId: string;
    items: BillItemCreate[];
  }): Promise<BillRecord>;
  findPaymentIdempotency(
    restaurantId: string,
    membershipId: string,
    key: string,
  ): Promise<PaymentIdempotencyRecord | null>;
  reservePaymentIdempotency(input: {
    restaurantId: string;
    membershipId: string;
    billId: string;
    key: string;
    requestHash: string;
    expiresAt: Date;
  }): Promise<void>;
  completePaymentIdempotency(input: {
    restaurantId: string;
    membershipId: string;
    key: string;
    paymentId: string;
    responseBody: Prisma.InputJsonValue;
  }): Promise<void>;
  lockBill(restaurantId: string, billId: string): Promise<BillRecord | null>;
  createPayment(input: {
    restaurantId: string;
    billId: string;
    membershipId: string;
    payment: CreatePaymentRequest;
    amountPaidMinor: number;
    status: BillStatus;
  }): Promise<{ paymentId: string; bill: BillRecord }>;
}

export interface BillingRepository {
  transaction<T>(
    work: (transaction: BillingTransaction) => Promise<T>,
  ): Promise<T>;
  findSession(
    restaurantId: string,
    tableSessionId: string,
  ): Promise<BillingSessionRecord | null>;
  listActiveSessions(restaurantId: string): Promise<ActiveSessionRecord[]>;
  findBill(restaurantId: string, billId: string): Promise<BillRecord | null>;
  findBillBySession(
    restaurantId: string,
    tableSessionId: string,
  ): Promise<BillRecord | null>;
  listBills(
    restaurantId: string,
    query: BillListQuery,
  ): Promise<{ records: BillRecord[]; total: number }>;
  findPaymentIdempotency(
    restaurantId: string,
    membershipId: string,
    key: string,
  ): Promise<PaymentIdempotencyRecord | null>;
}

function transactionRepository(
  client: Prisma.TransactionClient,
): BillingTransaction {
  return {
    async lockSession(restaurantId, tableSessionId) {
      const locked = await client.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "TableSession"
        WHERE "id" = ${tableSessionId}::uuid
          AND "restaurantId" = ${restaurantId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) return null;
      await client.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Order"
        WHERE "tableSessionId" = ${tableSessionId}::uuid
          AND "restaurantId" = ${restaurantId}::uuid
        ORDER BY "id"
        FOR UPDATE
      `;
      return client.tableSession.findUnique({
        where: { id_restaurantId: { id: tableSessionId, restaurantId } },
        select: sessionSelection,
      });
    },
    createBill(input) {
      return client.bill.create({
        data: {
          restaurantId: input.restaurantId,
          tableSessionId: input.tableSessionId,
          billNumber: input.billNumber,
          status: input.status,
          currency: input.currency,
          taxName: input.taxName,
          taxRateBasisPoints: input.taxRateBasisPoints,
          pricesIncludeTax: input.pricesIncludeTax,
          roundingPolicy: input.roundingPolicy,
          subtotalMinor: input.subtotalMinor,
          taxMinor: input.taxMinor,
          totalMinor: input.totalMinor,
          createdByMembershipId: input.membershipId,
          finalizedByMembershipId: input.membershipId,
          items: {
            create: input.items.map((item) => ({
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
              modifiers: {
                create: item.modifiers.map((modifier) => ({
                  ...modifier,
                })),
              },
            })),
          },
        },
        select: billSelection,
      });
    },
    findPaymentIdempotency: (restaurantId, membershipId, key) =>
      client.paymentIdempotency.findUnique({
        where: {
          restaurantId_actorMembershipId_key: {
            restaurantId,
            actorMembershipId: membershipId,
            key,
          },
        },
        select: { requestHash: true, responseBody: true },
      }),
    async reservePaymentIdempotency(input) {
      await client.paymentIdempotency.create({
        data: {
          restaurantId: input.restaurantId,
          actorMembershipId: input.membershipId,
          billId: input.billId,
          key: input.key,
          requestHash: input.requestHash,
          expiresAt: input.expiresAt,
        },
      });
    },
    async completePaymentIdempotency(input) {
      await client.paymentIdempotency.update({
        where: {
          restaurantId_actorMembershipId_key: {
            restaurantId: input.restaurantId,
            actorMembershipId: input.membershipId,
            key: input.key,
          },
        },
        data: {
          resultPaymentId: input.paymentId,
          responseBody: input.responseBody,
        },
      });
    },
    async lockBill(restaurantId, billId) {
      const locked = await client.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "Bill"
        WHERE "id" = ${billId}::uuid
          AND "restaurantId" = ${restaurantId}::uuid
        FOR UPDATE
      `;
      if (locked.length === 0) return null;
      return client.bill.findUnique({
        where: { id_restaurantId: { id: billId, restaurantId } },
        select: billSelection,
      });
    },
    async createPayment(input) {
      const payment = await client.payment.create({
        data: {
          restaurantId: input.restaurantId,
          billId: input.billId,
          amountMinor: input.payment.amountMinor,
          method: input.payment.method,
          reference: input.payment.reference ?? null,
          note: input.payment.note ?? null,
          recordedByMembershipId: input.membershipId,
        },
        select: { id: true },
      });
      const bill = await client.bill.update({
        where: {
          id_restaurantId: {
            id: input.billId,
            restaurantId: input.restaurantId,
          },
        },
        data: {
          amountPaidMinor: input.amountPaidMinor,
          status: input.status,
          version: { increment: 1 },
        },
        select: billSelection,
      });
      return { paymentId: payment.id, bill };
    },
  };
}

export class PrismaBillingRepository implements BillingRepository {
  constructor(private readonly prisma: PrismaClient) {}

  transaction<T>(work: (transaction: BillingTransaction) => Promise<T>) {
    return this.prisma.$transaction((client) =>
      work(transactionRepository(client)),
    );
  }

  findSession(restaurantId: string, tableSessionId: string) {
    return this.prisma.tableSession.findUnique({
      where: { id_restaurantId: { id: tableSessionId, restaurantId } },
      select: sessionSelection,
    });
  }

  listActiveSessions(restaurantId: string): Promise<ActiveSessionRecord[]> {
    return this.prisma.tableSession.findMany({
      where: { restaurantId, status: "OPEN", closedAt: null },
      select: {
        id: true,
        openedAt: true,
        table: { select: { id: true, tableNumber: true, displayName: true } },
        restaurant: { select: { currency: true } },
        orders: { select: { status: true } },
        bill: {
          select: {
            id: true,
            status: true,
            totalMinor: true,
            amountPaidMinor: true,
          },
        },
      },
      orderBy: [
        { table: { tableNumber: "asc" } },
        { openedAt: "asc" },
        { id: "asc" },
      ],
    });
  }

  findBill(restaurantId: string, billId: string) {
    return this.prisma.bill.findUnique({
      where: { id_restaurantId: { id: billId, restaurantId } },
      select: billSelection,
    });
  }

  findBillBySession(restaurantId: string, tableSessionId: string) {
    return this.prisma.bill.findFirst({
      where: { restaurantId, tableSessionId },
      select: billSelection,
    });
  }

  async listBills(restaurantId: string, query: BillListQuery) {
    const where = {
      restaurantId,
      ...(query.status ? { status: query.status } : {}),
      ...(query.search
        ? {
            OR: [
              {
                billNumber: {
                  contains: query.search,
                  mode: "insensitive" as const,
                },
              },
              {
                tableSession: {
                  table: {
                    OR: [
                      {
                        tableNumber: {
                          contains: query.search,
                          mode: "insensitive" as const,
                        },
                      },
                      {
                        displayName: {
                          contains: query.search,
                          mode: "insensitive" as const,
                        },
                      },
                    ],
                  },
                },
              },
            ],
          }
        : {}),
    } satisfies Prisma.BillWhereInput;
    const [records, total] = await this.prisma.$transaction([
      this.prisma.bill.findMany({
        where,
        select: billSelection,
        orderBy: [{ finalizedAt: "desc" }, { id: "desc" }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      this.prisma.bill.count({ where }),
    ]);
    return { records, total };
  }

  findPaymentIdempotency(
    restaurantId: string,
    membershipId: string,
    key: string,
  ) {
    return this.prisma.paymentIdempotency.findUnique({
      where: {
        restaurantId_actorMembershipId_key: {
          restaurantId,
          actorMembershipId: membershipId,
          key,
        },
      },
      select: { requestHash: true, responseBody: true },
    });
  }
}

export type BillingOrderItemRecord = {
  id: string;
  restaurantId: string;
  itemNameSnapshot: string;
  quantity: number;
  unitPriceMinor: number;
  lineTotalMinor: number;
  status: OrderItemStatus;
  batchNumber: number;
  modifiers: {
    modifierGroupNameSnapshot: string;
    modifierNameSnapshot: string;
    modifierPriceMinor: number;
    quantity: number;
  }[];
};
