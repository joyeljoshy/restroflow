import type {
  AuthenticatedUser,
  CreateTableRequest,
  Role,
  TableListQuery,
  TableSessionListQuery,
  UpdateTableRequest,
} from "@restroflow/contracts";
import {
  errorResponseSchema,
  tableListResponseSchema,
  tableQrCodeResponseSchema,
  tableResponseSchema,
  tableSessionListResponseSchema,
  tableSessionResponseSchema,
} from "@restroflow/contracts";
import pino from "pino";
import request from "supertest";
import { beforeEach, describe, expect, it } from "vitest";

import { createApp } from "../../app.js";
import type { AuthServiceContract } from "../auth/auth.service.js";
import type {
  RestaurantTableRecord,
  TableRepository,
  TableSessionRecord,
} from "./table.repository.js";
import { TableService } from "./table.service.js";

const restaurantId = "9010e67f-4aa1-428e-bc26-6de08366aab2";
const otherRestaurantId = "ab88f4ee-d8e4-4dc6-8400-99ee336983e7";
const membershipId = "30000000-0000-4000-8000-000000000001";
const fixedDate = new Date("2026-11-19T09:00:00.000Z");

type StoredTable = Omit<RestaurantTableRecord, "sessions"> & {
  restaurantId: string;
};
type StoredSession = TableSessionRecord & { restaurantId: string };

class MemoryTableRepository implements TableRepository {
  tables: StoredTable[] = [];
  sessions: StoredSession[] = [];
  private sequence = 0;

  private id() {
    this.sequence += 1;
    return `10000000-0000-4000-8000-${this.sequence.toString().padStart(12, "0")}`;
  }

  private actor(id: string) {
    return { id, user: { displayName: "Test Staff" } };
  }

  private hydrate(table: StoredTable): RestaurantTableRecord {
    return {
      ...table,
      sessions: this.sessions.filter(
        (session) => session.tableId === table.id && !session.closedAt,
      ),
    };
  }

  listTables(scope: string, query: TableListQuery) {
    return Promise.resolve(
      this.tables
        .filter((table) => {
          const active = this.sessions.some(
            (session) => session.tableId === table.id && !session.closedAt,
          );
          const text =
            `${table.tableNumber} ${table.displayName}`.toLowerCase();
          return (
            table.restaurantId === scope &&
            (!query.search || text.includes(query.search.toLowerCase())) &&
            (query.occupancy === "all" ||
              (query.occupancy === "available" && table.isActive && !active) ||
              (query.occupancy === "occupied" && table.isActive && active) ||
              (query.occupancy === "out_of_service" && !table.isActive))
          );
        })
        .map((table) => this.hydrate(table)),
    );
  }

  findTable(scope: string, tableId: string) {
    const table = this.tables.find(
      (candidate) =>
        candidate.restaurantId === scope && candidate.id === tableId,
    );
    return Promise.resolve(table ? this.hydrate(table) : null);
  }

  createTable(scope: string, input: CreateTableRequest, qrIdentifier: string) {
    if (
      this.tables.some(
        (table) =>
          table.restaurantId === scope &&
          table.tableNumber === input.tableNumber,
      )
    )
      return Promise.reject(
        Object.assign(new Error("Duplicate table"), { code: "P2002" }),
      );
    const table: StoredTable = {
      id: this.id(),
      restaurantId: scope,
      qrIdentifier,
      ...input,
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };
    this.tables.push(table);
    return Promise.resolve(this.hydrate(table));
  }

  updateTable(scope: string, tableId: string, input: UpdateTableRequest) {
    const table = this.tables.find(
      (candidate) =>
        candidate.restaurantId === scope && candidate.id === tableId,
    );
    if (!table) throw new Error("Unknown table");
    if (
      input.tableNumber &&
      this.tables.some(
        (candidate) =>
          candidate.restaurantId === scope &&
          candidate.id !== tableId &&
          candidate.tableNumber === input.tableNumber,
      )
    )
      throw Object.assign(new Error("Duplicate table"), { code: "P2002" });
    Object.assign(table, input);
    return Promise.resolve(this.hydrate(table));
  }

  rotateQrIdentifier(scope: string, tableId: string, qrIdentifier: string) {
    const table = this.tables.find(
      (candidate) =>
        candidate.restaurantId === scope && candidate.id === tableId,
    );
    if (!table) throw new Error("Unknown table");
    table.qrIdentifier = qrIdentifier;
    return Promise.resolve(this.hydrate(table));
  }

  listSessions(scope: string, tableId: string, query: TableSessionListQuery) {
    return Promise.resolve(
      this.sessions.filter(
        (session) =>
          session.restaurantId === scope &&
          session.tableId === tableId &&
          (query.status === "all" ||
            (query.status === "open" && !session.closedAt) ||
            (query.status === "closed" && Boolean(session.closedAt))),
      ),
    );
  }

  findSession(scope: string, sessionId: string) {
    return Promise.resolve(
      this.sessions.find(
        (session) => session.restaurantId === scope && session.id === sessionId,
      ) ?? null,
    );
  }

  openSession(scope: string, tableId: string, actorId: string) {
    if (
      this.sessions.some(
        (session) => session.tableId === tableId && !session.closedAt,
      )
    )
      return Promise.reject(
        Object.assign(new Error("Open session exists"), { code: "P2002" }),
      );
    const session: StoredSession = {
      id: this.id(),
      restaurantId: scope,
      tableId,
      status: "OPEN",
      openedAt: fixedDate,
      closedAt: null,
      openedBy: this.actor(actorId),
      closedBy: null,
      createdAt: fixedDate,
      updatedAt: fixedDate,
    };
    this.sessions.push(session);
    return Promise.resolve(session);
  }

  closeSession(scope: string, sessionId: string, actorId: string) {
    const session = this.sessions.find(
      (candidate) =>
        candidate.restaurantId === scope &&
        candidate.id === sessionId &&
        !candidate.closedAt,
    );
    if (!session) return Promise.resolve(null);
    session.status = "CLOSED";
    session.closedAt = fixedDate;
    session.closedBy = this.actor(actorId);
    return Promise.resolve(session);
  }
}

function authService(role: Role, scope = restaurantId): AuthServiceContract {
  const user: AuthenticatedUser = {
    id: "f2bb8ad8-efb4-4d6a-a942-d31a4b432fb2",
    email: "staff@example.com",
    displayName: "Test Staff",
    memberships: [{ restaurantId: scope, restaurantName: "RestroFlow", role }],
  };
  return {
    login: () => Promise.reject(new Error("Not used")),
    logout: () => Promise.resolve(),
    authenticate: () =>
      Promise.resolve({
        user,
        sessionTokenHash: "hash",
        membershipIds: { [scope]: membershipId },
      }),
  };
}

describe("table and table-session API", () => {
  let repository: MemoryTableRepository;

  beforeEach(() => {
    repository = new MemoryTableRepository();
  });

  function app(role: Role = "ADMIN", scope = restaurantId) {
    return createApp({
      allowedOrigins: ["http://localhost:3000"],
      authService: authService(role, scope),
      cookieOptions: { secure: false, maxAgeMs: 60_000 },
      healthRepository: { isDatabaseAvailable: () => Promise.resolve(true) },
      loginRateLimitMax: 50,
      logger: pino({ enabled: false }),
      restaurantService: {
        get: () => Promise.reject(new Error("unused")),
        update: () => Promise.reject(new Error("unused")),
      },
      staffService: {
        list: () => Promise.reject(new Error("unused")),
        create: () => Promise.reject(new Error("unused")),
        update: () => Promise.reject(new Error("unused")),
      },
      tableService: new TableService(repository, "http://localhost:3000"),
    });
  }

  async function createTable(number = "T1") {
    const response = await request(app())
      .post("/api/v1/tables")
      .send({
        tableNumber: number,
        displayName: `Table ${number}`,
        capacity: 4,
      })
      .expect(201);
    return tableResponseSchema.parse(response.body).table;
  }

  it("creates, lists, updates, filters, and safely deactivates tables", async () => {
    const table = await createTable();
    const listing = await request(app())
      .get("/api/v1/tables")
      .query({ search: "table t1", occupancy: "available" })
      .expect(200);
    expect(tableListResponseSchema.parse(listing.body).tables).toHaveLength(1);
    const updated = await request(app())
      .patch(`/api/v1/tables/${table.id}`)
      .send({ displayName: "Window table", capacity: 6 })
      .expect(200);
    expect(tableResponseSchema.parse(updated.body).table).toMatchObject({
      displayName: "Window table",
      capacity: 6,
    });
    const deactivated = await request(app())
      .delete(`/api/v1/tables/${table.id}`)
      .expect(200);
    expect(tableResponseSchema.parse(deactivated.body).table.occupancy).toBe(
      "OUT_OF_SERVICE",
    );
  });

  it("rejects invalid capacity and duplicate table numbers", async () => {
    await request(app())
      .post("/api/v1/tables")
      .send({ tableNumber: "T1", displayName: "Invalid", capacity: 0 })
      .expect(400);
    await createTable();
    await request(app())
      .patch(`/api/v1/tables/${repository.tables[0]!.id}`)
      .send({})
      .expect(400);
    const conflict = await request(app())
      .post("/api/v1/tables")
      .send({ tableNumber: "T1", displayName: "Duplicate", capacity: 2 })
      .expect(409);
    expect(errorResponseSchema.parse(conflict.body).error.code).toBe(
      "TABLE_NUMBER_CONFLICT",
    );
  });

  it("opens and closes sessions while preserving history and occupancy", async () => {
    const table = await createTable();
    const opened = await request(app("WAITER"))
      .post(`/api/v1/tables/${table.id}/sessions`)
      .expect(201);
    const session = tableSessionResponseSchema.parse(opened.body).session;
    const activeSession = await request(app("CASHIER"))
      .get(`/api/v1/table-sessions/${session.id}`)
      .expect(200);
    expect(
      tableSessionResponseSchema.parse(activeSession.body).session.id,
    ).toBe(session.id);
    const occupied = await request(app("WAITER"))
      .get(`/api/v1/tables/${table.id}`)
      .expect(200);
    expect(tableResponseSchema.parse(occupied.body).table.occupancy).toBe(
      "OCCUPIED",
    );
    await request(app("WAITER"))
      .post(`/api/v1/table-sessions/${session.id}/close`)
      .expect(200);
    await request(app("CASHIER"))
      .get(`/api/v1/table-sessions/${session.id}`)
      .expect(404);
    const available = await request(app("WAITER"))
      .get(`/api/v1/tables/${table.id}`)
      .expect(200);
    expect(tableResponseSchema.parse(available.body).table.occupancy).toBe(
      "AVAILABLE",
    );
    const history = await request(app("WAITER"))
      .get(`/api/v1/tables/${table.id}/sessions`)
      .expect(200);
    expect(
      tableSessionListResponseSchema.parse(history.body).sessions[0],
    ).toMatchObject({ status: "CLOSED", id: session.id });
  });

  it("prevents concurrent duplicate sessions and invalid transitions", async () => {
    const table = await createTable();
    const [first, second] = await Promise.all([
      request(app("WAITER")).post(`/api/v1/tables/${table.id}/sessions`),
      request(app("WAITER")).post(`/api/v1/tables/${table.id}/sessions`),
    ]);
    expect([first.status, second.status].sort()).toEqual([201, 409]);
    const session = tableSessionResponseSchema.parse(
      first.status === 201 ? first.body : second.body,
    ).session;
    await request(app("WAITER"))
      .post(`/api/v1/table-sessions/${session.id}/close`)
      .expect(200);
    const secondClose = await request(app("WAITER"))
      .post(`/api/v1/table-sessions/${session.id}/close`)
      .expect(409);
    expect(errorResponseSchema.parse(secondClose.body).error.code).toBe(
      "TABLE_SESSION_ALREADY_CLOSED",
    );
  });

  it("blocks sessions for out-of-service tables and deactivation while occupied", async () => {
    const table = await createTable();
    const opened = await request(app("WAITER"))
      .post(`/api/v1/tables/${table.id}/sessions`)
      .expect(201);
    await request(app()).delete(`/api/v1/tables/${table.id}`).expect(409);
    const session = tableSessionResponseSchema.parse(opened.body).session;
    await request(app("WAITER"))
      .post(`/api/v1/table-sessions/${session.id}/close`)
      .expect(200);
    await request(app()).delete(`/api/v1/tables/${table.id}`).expect(200);
    const blocked = await request(app("WAITER"))
      .post(`/api/v1/tables/${table.id}/sessions`)
      .expect(409);
    expect(errorResponseSchema.parse(blocked.body).error.code).toBe(
      "TABLE_OUT_OF_SERVICE",
    );
  });

  it("enforces restaurant isolation and role restrictions", async () => {
    const table = await createTable();
    await request(app("ADMIN", otherRestaurantId))
      .get(`/api/v1/tables/${table.id}`)
      .expect(404);
    await request(app("WAITER"))
      .patch(`/api/v1/tables/${table.id}`)
      .send({ capacity: 8 })
      .expect(403);
    await request(app("MANAGER"))
      .patch(`/api/v1/tables/${table.id}`)
      .send({ capacity: 8 })
      .expect(403);
    await request(app("MANAGER"))
      .patch(`/api/v1/tables/${table.id}`)
      .send({ isActive: false })
      .expect(200);
    await request(app("MANAGER"))
      .patch(`/api/v1/tables/${table.id}`)
      .send({ isActive: true })
      .expect(200);
    await request(app("KITCHEN")).get("/api/v1/tables").expect(200);
    await request(app("KITCHEN"))
      .post(`/api/v1/tables/${table.id}/sessions`)
      .expect(403);
  });

  it("creates valid QR output and invalidates the previous identifier on rotation", async () => {
    const table = await createTable();
    const initialResponse = await request(app())
      .get(`/api/v1/tables/${table.id}/qr`)
      .expect(200);
    const initial = tableQrCodeResponseSchema.parse(
      initialResponse.body,
    ).qrCode;
    expect(initial.svg).toContain("<svg");
    expect(initial.targetUrl).toContain(initial.qrIdentifier);
    const rotatedResponse = await request(app())
      .post(`/api/v1/tables/${table.id}/qr/rotate`)
      .expect(200);
    const rotated = tableQrCodeResponseSchema.parse(
      rotatedResponse.body,
    ).qrCode;
    expect(rotated.qrIdentifier).not.toBe(initial.qrIdentifier);
    expect(repository.tables[0]?.qrIdentifier).toBe(rotated.qrIdentifier);
    await request(app("MANAGER"))
      .get(`/api/v1/tables/${table.id}/qr`)
      .expect(403);
  });
});
