import { randomBytes } from "node:crypto";

import type {
  CreateTableRequest,
  RestaurantTable,
  Role,
  TableListQuery,
  TableQrCode,
  TableSession,
  TableSessionListQuery,
  UpdateTableRequest,
} from "@restroflow/contracts";
import QRCode from "qrcode";

import { AppError } from "../../errors/app-error.js";
import { unresolvedOrderStatuses } from "../orders/order.policy.js";
import type {
  RestaurantTableRecord,
  TableRepository,
  TableSessionRecord,
} from "./table.repository.js";

export interface TableServiceContract {
  listTables(
    restaurantId: string,
    query: TableListQuery,
  ): Promise<RestaurantTable[]>;
  getTable(restaurantId: string, tableId: string): Promise<RestaurantTable>;
  createTable(
    restaurantId: string,
    input: CreateTableRequest,
  ): Promise<RestaurantTable>;
  updateTable(
    restaurantId: string,
    tableId: string,
    input: UpdateTableRequest,
    role: Role,
  ): Promise<RestaurantTable>;
  deactivateTable(
    restaurantId: string,
    tableId: string,
  ): Promise<RestaurantTable>;
  openSession(
    restaurantId: string,
    tableId: string,
    membershipId: string,
  ): Promise<TableSession>;
  listSessions(
    restaurantId: string,
    tableId: string,
    query: TableSessionListQuery,
  ): Promise<TableSession[]>;
  getSession(restaurantId: string, sessionId: string): Promise<TableSession>;
  closeSession(
    restaurantId: string,
    sessionId: string,
    membershipId: string,
  ): Promise<TableSession>;
  getQrCode(restaurantId: string, tableId: string): Promise<TableQrCode>;
  rotateQrCode(restaurantId: string, tableId: string): Promise<TableQrCode>;
}

function toSession(record: TableSessionRecord): TableSession {
  return {
    id: record.id,
    tableId: record.tableId,
    status: record.status,
    openedAt: record.openedAt.toISOString(),
    closedAt: record.closedAt?.toISOString() ?? null,
    openedBy: {
      id: record.openedBy.id,
      displayName: record.openedBy.user.displayName,
    },
    closedBy: record.closedBy
      ? {
          id: record.closedBy.id,
          displayName: record.closedBy.user.displayName,
        }
      : null,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function toTable(record: RestaurantTableRecord): RestaurantTable {
  const activeSession = record.sessions[0]
    ? toSession(record.sessions[0])
    : null;
  return {
    id: record.id,
    tableNumber: record.tableNumber,
    displayName: record.displayName,
    capacity: record.capacity,
    isActive: record.isActive,
    occupancy: !record.isActive
      ? "OUT_OF_SERVICE"
      : activeSession
        ? "OCCUPIED"
        : "AVAILABLE",
    activeSession,
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

function isUniqueConstraintError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "P2002"
  );
}

function newQrIdentifier(): string {
  return randomBytes(32).toString("base64url");
}

export class TableService implements TableServiceContract {
  private readonly publicWebOrigin: string;

  constructor(
    private readonly repository: TableRepository,
    publicWebOrigin: string,
  ) {
    this.publicWebOrigin = publicWebOrigin.replace(/\/$/, "");
  }

  async listTables(restaurantId: string, query: TableListQuery) {
    return (await this.repository.listTables(restaurantId, query)).map(toTable);
  }

  async getTable(restaurantId: string, tableId: string) {
    return toTable(await this.requireTable(restaurantId, tableId));
  }

  async createTable(restaurantId: string, input: CreateTableRequest) {
    try {
      return toTable(
        await this.repository.createTable(
          restaurantId,
          input,
          newQrIdentifier(),
        ),
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new AppError(
          409,
          "TABLE_NUMBER_CONFLICT",
          "A table with that number already exists in this restaurant.",
        );
      throw error;
    }
  }

  async updateTable(
    restaurantId: string,
    tableId: string,
    input: UpdateTableRequest,
    role: Role,
  ) {
    const table = await this.requireTable(restaurantId, tableId);
    if (role === "MANAGER") {
      const fields = Object.keys(input);
      if (fields.some((field) => field !== "isActive"))
        throw new AppError(
          403,
          "TABLE_CONFIGURATION_FORBIDDEN",
          "Managers can only change a table's operational state.",
        );
    }
    if (input.isActive === false && table.sessions.length > 0)
      throw new AppError(
        409,
        "TABLE_SESSION_ACTIVE",
        "Close the active table session before taking the table out of service.",
      );
    try {
      return toTable(
        await this.repository.updateTable(restaurantId, tableId, input),
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new AppError(
          409,
          "TABLE_NUMBER_CONFLICT",
          "A table with that number already exists in this restaurant.",
        );
      throw error;
    }
  }

  deactivateTable(restaurantId: string, tableId: string) {
    return this.updateTable(
      restaurantId,
      tableId,
      { isActive: false },
      "ADMIN",
    );
  }

  async openSession(
    restaurantId: string,
    tableId: string,
    membershipId: string,
  ) {
    const table = await this.requireTable(restaurantId, tableId);
    if (!table.isActive)
      throw new AppError(
        409,
        "TABLE_OUT_OF_SERVICE",
        "Out-of-service tables cannot open sessions.",
      );
    if (table.sessions.length > 0)
      throw new AppError(
        409,
        "TABLE_SESSION_ACTIVE",
        "This table already has an active session.",
      );
    try {
      return toSession(
        await this.repository.openSession(restaurantId, tableId, membershipId),
      );
    } catch (error) {
      if (isUniqueConstraintError(error))
        throw new AppError(
          409,
          "TABLE_SESSION_ACTIVE",
          "This table already has an active session.",
        );
      throw error;
    }
  }

  async listSessions(
    restaurantId: string,
    tableId: string,
    query: TableSessionListQuery,
  ) {
    await this.requireTable(restaurantId, tableId);
    return (
      await this.repository.listSessions(restaurantId, tableId, query)
    ).map(toSession);
  }

  async getSession(restaurantId: string, sessionId: string) {
    const session = await this.repository.findSession(restaurantId, sessionId);
    if (!session)
      throw new AppError(
        404,
        "TABLE_SESSION_NOT_FOUND",
        "Table session not found.",
      );
    return toSession(session);
  }

  async closeSession(
    restaurantId: string,
    sessionId: string,
    membershipId: string,
  ) {
    const session = await this.repository.findSession(restaurantId, sessionId);
    if (!session)
      throw new AppError(
        404,
        "TABLE_SESSION_NOT_FOUND",
        "Table session not found.",
      );
    if (session.status !== "OPEN" || session.closedAt)
      throw new AppError(
        409,
        "TABLE_SESSION_ALREADY_CLOSED",
        "This table session is already closed.",
      );
    if (this.repository.closeSessionGuarded) {
      const result = await this.repository.closeSessionGuarded(
        restaurantId,
        sessionId,
        membershipId,
        unresolvedOrderStatuses,
      );
      if (result.kind === "unresolved_orders")
        throw new AppError(
          409,
          "TABLE_SESSION_HAS_UNRESOLVED_ORDERS",
          "Resolve pending restaurant orders before closing this table session.",
        );
      if (result.kind === "billing_incomplete")
        throw new AppError(
          409,
          "TABLE_SESSION_BILLING_INCOMPLETE",
          "Finalize a bill containing every served item before closing this table session.",
        );
      if (result.kind === "unpaid_bill")
        throw new AppError(
          409,
          "TABLE_SESSION_HAS_OUTSTANDING_BALANCE",
          "Record the full outstanding balance before closing this table session.",
        );
      if (result.kind === "not_open")
        throw new AppError(
          409,
          "TABLE_SESSION_ALREADY_CLOSED",
          "This table session is already closed.",
        );
      return toSession(result.session);
    }
    const closed = await this.repository.closeSession(
      restaurantId,
      sessionId,
      membershipId,
    );
    if (!closed)
      throw new AppError(
        409,
        "TABLE_SESSION_ALREADY_CLOSED",
        "This table session is already closed.",
      );
    return toSession(closed);
  }

  async getQrCode(restaurantId: string, tableId: string) {
    return this.qrCode(await this.requireTable(restaurantId, tableId));
  }

  async rotateQrCode(restaurantId: string, tableId: string) {
    await this.requireTable(restaurantId, tableId);
    const table = await this.repository.rotateQrIdentifier(
      restaurantId,
      tableId,
      newQrIdentifier(),
    );
    return this.qrCode(table);
  }

  private async requireTable(restaurantId: string, tableId: string) {
    const table = await this.repository.findTable(restaurantId, tableId);
    if (!table) throw new AppError(404, "TABLE_NOT_FOUND", "Table not found.");
    return table;
  }

  private async qrCode(table: RestaurantTableRecord): Promise<TableQrCode> {
    const targetUrl = `${this.publicWebOrigin}/menu/table/${encodeURIComponent(table.qrIdentifier)}`;
    const svg = await QRCode.toString(targetUrl, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 2,
      width: 320,
    });
    const safeNumber = table.tableNumber.replace(/[^a-zA-Z0-9_-]+/g, "-");
    return {
      qrIdentifier: table.qrIdentifier,
      targetUrl,
      svg,
      fileName: `restroflow-table-${safeNumber || "qr"}.svg`,
    };
  }
}
