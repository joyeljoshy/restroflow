import type {
  CreateTableRequest,
  TableListQuery,
  TableSessionListQuery,
  UpdateTableRequest,
} from "@restroflow/contracts";

import type { Prisma, PrismaClient } from "../../generated/prisma/client.js";

export type TableSessionRecord = {
  id: string;
  tableId: string;
  status: "OPEN" | "CLOSED";
  openedAt: Date;
  closedAt: Date | null;
  openedBy: { id: string; user: { displayName: string } };
  closedBy: { id: string; user: { displayName: string } } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type RestaurantTableRecord = {
  id: string;
  tableNumber: string;
  displayName: string;
  capacity: number;
  isActive: boolean;
  qrIdentifier: string;
  sessions: TableSessionRecord[];
  createdAt: Date;
  updatedAt: Date;
};

export interface TableRepository {
  listTables(
    restaurantId: string,
    query: TableListQuery,
  ): Promise<RestaurantTableRecord[]>;
  findTable(
    restaurantId: string,
    tableId: string,
  ): Promise<RestaurantTableRecord | null>;
  createTable(
    restaurantId: string,
    input: CreateTableRequest,
    qrIdentifier: string,
  ): Promise<RestaurantTableRecord>;
  updateTable(
    restaurantId: string,
    tableId: string,
    input: UpdateTableRequest,
  ): Promise<RestaurantTableRecord>;
  rotateQrIdentifier(
    restaurantId: string,
    tableId: string,
    qrIdentifier: string,
  ): Promise<RestaurantTableRecord>;
  listSessions(
    restaurantId: string,
    tableId: string,
    query: TableSessionListQuery,
  ): Promise<TableSessionRecord[]>;
  findSession(
    restaurantId: string,
    sessionId: string,
  ): Promise<TableSessionRecord | null>;
  openSession(
    restaurantId: string,
    tableId: string,
    membershipId: string,
  ): Promise<TableSessionRecord>;
  closeSession(
    restaurantId: string,
    sessionId: string,
    membershipId: string,
  ): Promise<TableSessionRecord | null>;
}

const actorSelection = {
  id: true,
  user: { select: { displayName: true } },
} satisfies Prisma.StaffMembershipSelect;

const sessionSelection = {
  id: true,
  tableId: true,
  status: true,
  openedAt: true,
  closedAt: true,
  openedBy: { select: actorSelection },
  closedBy: { select: actorSelection },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.TableSessionSelect;

const tableSelection = {
  id: true,
  tableNumber: true,
  displayName: true,
  capacity: true,
  isActive: true,
  qrIdentifier: true,
  sessions: {
    where: { closedAt: null },
    select: sessionSelection,
    orderBy: [{ openedAt: "desc" as const }, { id: "desc" as const }],
    take: 1,
  },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RestaurantTableSelect;

export class PrismaTableRepository implements TableRepository {
  constructor(private readonly prisma: PrismaClient) {}

  listTables(restaurantId: string, query: TableListQuery) {
    return this.prisma.restaurantTable.findMany({
      where: {
        restaurantId,
        ...(query.search
          ? {
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
            }
          : {}),
        ...(query.occupancy === "available"
          ? { isActive: true, sessions: { none: { closedAt: null } } }
          : query.occupancy === "occupied"
            ? { isActive: true, sessions: { some: { closedAt: null } } }
            : query.occupancy === "out_of_service"
              ? { isActive: false }
              : {}),
      },
      select: tableSelection,
      orderBy: [{ tableNumber: "asc" }, { id: "asc" }],
    });
  }

  findTable(restaurantId: string, tableId: string) {
    return this.prisma.restaurantTable.findFirst({
      where: { id: tableId, restaurantId },
      select: tableSelection,
    });
  }

  createTable(
    restaurantId: string,
    input: CreateTableRequest,
    qrIdentifier: string,
  ) {
    return this.prisma.restaurantTable.create({
      data: { restaurantId, qrIdentifier, ...input },
      select: tableSelection,
    });
  }

  updateTable(
    restaurantId: string,
    tableId: string,
    input: UpdateTableRequest,
  ) {
    return this.prisma.restaurantTable.update({
      where: { id_restaurantId: { id: tableId, restaurantId } },
      data: input,
      select: tableSelection,
    });
  }

  rotateQrIdentifier(
    restaurantId: string,
    tableId: string,
    qrIdentifier: string,
  ) {
    return this.prisma.restaurantTable.update({
      where: { id_restaurantId: { id: tableId, restaurantId } },
      data: { qrIdentifier },
      select: tableSelection,
    });
  }

  listSessions(
    restaurantId: string,
    tableId: string,
    query: TableSessionListQuery,
  ) {
    return this.prisma.tableSession.findMany({
      where: {
        restaurantId,
        tableId,
        ...(query.status === "open"
          ? { closedAt: null }
          : query.status === "closed"
            ? { closedAt: { not: null } }
            : {}),
      },
      select: sessionSelection,
      orderBy: [{ openedAt: "desc" }, { id: "desc" }],
    });
  }

  findSession(restaurantId: string, sessionId: string) {
    return this.prisma.tableSession.findFirst({
      where: { id: sessionId, restaurantId },
      select: sessionSelection,
    });
  }

  openSession(restaurantId: string, tableId: string, membershipId: string) {
    return this.prisma.tableSession.create({
      data: {
        restaurantId,
        tableId,
        openedByMembershipId: membershipId,
      },
      select: sessionSelection,
    });
  }

  closeSession(restaurantId: string, sessionId: string, membershipId: string) {
    return this.prisma.$transaction(async (transaction) => {
      const result = await transaction.tableSession.updateMany({
        where: {
          id: sessionId,
          restaurantId,
          status: "OPEN",
          closedAt: null,
        },
        data: {
          status: "CLOSED",
          closedAt: new Date(),
          closedByMembershipId: membershipId,
        },
      });
      if (result.count === 0) return null;
      return transaction.tableSession.findUniqueOrThrow({
        where: { id_restaurantId: { id: sessionId, restaurantId } },
        select: sessionSelection,
      });
    });
  }
}
