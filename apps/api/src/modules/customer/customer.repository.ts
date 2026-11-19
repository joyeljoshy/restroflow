import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

const publicTableSelection = {
  id: true,
  restaurantId: true,
  tableNumber: true,
  displayName: true,
  isActive: true,
  restaurant: { select: { name: true, currency: true, isActive: true } },
  sessions: {
    where: { status: "OPEN" as const, closedAt: null },
    select: { id: true },
    orderBy: { openedAt: "desc" as const },
    take: 1,
  },
} satisfies Prisma.RestaurantTableSelect;

export type PublicTableRecord = Prisma.RestaurantTableGetPayload<{
  select: typeof publicTableSelection;
}>;

export type CustomerSessionRecord = {
  id: string;
  restaurantId: string;
  tableSessionId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  restaurant: { name: string; isActive: boolean };
  tableSession: {
    status: "OPEN" | "CLOSED";
    closedAt: Date | null;
    table: { displayName: string; isActive: boolean };
  };
};

export interface CustomerRepository {
  findPublicTable(identifier: string): Promise<PublicTableRecord | null>;
  findPublicTableForSession(
    restaurantId: string,
    tableSessionId: string,
  ): Promise<PublicTableRecord | null>;
  listPublicMenu(restaurantId: string): Promise<{
    categories: Array<{
      id: string;
      name: string;
      description: string | null;
      sortOrder: number;
    }>;
    items: Array<{
      id: string;
      categoryId: string;
      name: string;
      description: string | null;
      priceMinor: number;
      imageUrl: string | null;
      isVegetarian: boolean;
      sortOrder: number;
      modifierGroups: Array<{
        sortOrder: number;
        modifierGroup: {
          id: string;
          name: string;
          minSelections: number;
          maxSelections: number;
          isActive: boolean;
          modifiers: Array<{
            id: string;
            name: string;
            priceDeltaMinor: number;
          }>;
        };
      }>;
    }>;
  }>;
  issueActivation(input: {
    restaurantId: string;
    tableSessionId: string;
    codeHash: string;
    expiresAt: Date;
  }): Promise<void>;
  findActivation(tableSessionId: string): Promise<{
    id: string;
    codeHash: string;
    expiresAt: Date;
    failedAttempts: number;
    lockedAt: Date | null;
    revokedAt: Date | null;
  } | null>;
  registerFailedAttempt(id: string, maximum: number, now: Date): Promise<void>;
  consumeActivation(input: {
    activationId: string;
    restaurantId: string;
    tableSessionId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
    maximumAttempts: number;
  }): Promise<CustomerSessionRecord | null>;
  findCustomerSession(tokenHash: string): Promise<CustomerSessionRecord | null>;
  touchCustomerSession(id: string, now: Date): Promise<void>;
  revokeCustomerSession(tokenHash: string, now: Date): Promise<void>;
}

const customerSessionSelection = {
  id: true,
  restaurantId: true,
  tableSessionId: true,
  expiresAt: true,
  revokedAt: true,
  lastUsedAt: true,
  restaurant: { select: { name: true, isActive: true } },
  tableSession: {
    select: {
      status: true,
      closedAt: true,
      table: { select: { displayName: true, isActive: true } },
    },
  },
} satisfies Prisma.CustomerOrderingSessionSelect;

export class PrismaCustomerRepository implements CustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  findPublicTable(identifier: string) {
    return this.prisma.restaurantTable.findUnique({
      where: { qrIdentifier: identifier },
      select: publicTableSelection,
    });
  }

  findPublicTableForSession(restaurantId: string, tableSessionId: string) {
    return this.prisma.restaurantTable.findFirst({
      where: { restaurantId, sessions: { some: { id: tableSessionId } } },
      select: publicTableSelection,
    });
  }

  async listPublicMenu(restaurantId: string) {
    const [categories, items] = await this.prisma.$transaction([
      this.prisma.menuCategory.findMany({
        where: { restaurantId, isActive: true },
        select: { id: true, name: true, description: true, sortOrder: true },
        orderBy: [{ sortOrder: "asc" }, { name: "asc" }, { id: "asc" }],
        take: 100,
      }),
      this.prisma.menuItem.findMany({
        where: {
          restaurantId,
          isActive: true,
          isAvailable: true,
          category: { isActive: true },
        },
        select: {
          id: true,
          categoryId: true,
          name: true,
          description: true,
          priceMinor: true,
          imageUrl: true,
          isVegetarian: true,
          sortOrder: true,
          modifierGroups: {
            select: {
              sortOrder: true,
              modifierGroup: {
                select: {
                  id: true,
                  name: true,
                  minSelections: true,
                  maxSelections: true,
                  isActive: true,
                  modifiers: {
                    where: { isAvailable: true },
                    select: { id: true, name: true, priceDeltaMinor: true },
                    orderBy: [{ name: "asc" }, { id: "asc" }],
                  },
                },
              },
            },
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
          },
        },
        orderBy: [
          { category: { sortOrder: "asc" } },
          { sortOrder: "asc" },
          { name: "asc" },
          { id: "asc" },
        ],
        take: 500,
      }),
    ]);
    return { categories, items };
  }

  issueActivation(input: {
    restaurantId: string;
    tableSessionId: string;
    codeHash: string;
    expiresAt: Date;
  }) {
    return this.prisma.$transaction(async (transaction) => {
      await transaction.tableOrderingActivation.updateMany({
        where: { tableSessionId: input.tableSessionId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      await transaction.tableOrderingActivation.create({ data: input });
    });
  }

  findActivation(tableSessionId: string) {
    return this.prisma.tableOrderingActivation.findFirst({
      where: { tableSessionId, revokedAt: null },
      select: {
        id: true,
        codeHash: true,
        expiresAt: true,
        failedAttempts: true,
        lockedAt: true,
        revokedAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  }

  async registerFailedAttempt(id: string, maximum: number, now: Date) {
    await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.tableOrderingActivation.update({
        where: { id },
        data: { failedAttempts: { increment: 1 } },
        select: { failedAttempts: true, lockedAt: true },
      });
      if (current.failedAttempts >= maximum && !current.lockedAt)
        await transaction.tableOrderingActivation.update({
          where: { id },
          data: { lockedAt: now },
        });
    });
  }

  consumeActivation(input: {
    activationId: string;
    restaurantId: string;
    tableSessionId: string;
    tokenHash: string;
    expiresAt: Date;
    now: Date;
    maximumAttempts: number;
  }) {
    return this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.tableOrderingActivation.updateMany({
        where: {
          id: input.activationId,
          tableSessionId: input.tableSessionId,
          restaurantId: input.restaurantId,
          revokedAt: null,
          lockedAt: null,
          expiresAt: { gt: input.now },
          failedAttempts: { lt: input.maximumAttempts },
        },
        data: { revokedAt: input.now },
      });
      if (consumed.count !== 1) return null;
      return transaction.customerOrderingSession.create({
        data: {
          restaurantId: input.restaurantId,
          tableSessionId: input.tableSessionId,
          tokenHash: input.tokenHash,
          expiresAt: input.expiresAt,
          lastUsedAt: input.now,
        },
        select: customerSessionSelection,
      });
    });
  }

  findCustomerSession(tokenHash: string) {
    return this.prisma.customerOrderingSession.findUnique({
      where: { tokenHash },
      select: customerSessionSelection,
    });
  }

  async touchCustomerSession(id: string, now: Date) {
    await this.prisma.customerOrderingSession.updateMany({
      where: { id, revokedAt: null },
      data: { lastUsedAt: now },
    });
  }

  async revokeCustomerSession(tokenHash: string, now: Date) {
    await this.prisma.customerOrderingSession.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: now },
    });
  }
}
