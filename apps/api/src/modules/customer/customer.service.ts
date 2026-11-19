import { createHash, randomBytes, randomInt } from "node:crypto";

import { customerOrderSchema } from "@restroflow/contracts";
import type {
  CustomerCreateOrderRequest,
  CustomerOrder,
  CustomerSession,
  PublicTableContext,
} from "@restroflow/contracts";

import { AppError } from "../../errors/app-error.js";
import type { PasswordHasher } from "../auth/auth.service.js";
import type { OrderServiceContract } from "../orders/order.service.js";
import type {
  CustomerRepository,
  CustomerSessionRecord,
  PublicTableRecord,
} from "./customer.repository.js";

const ACTIVATION_TTL_MS = 10 * 60 * 1000;
const CUSTOMER_SESSION_TTL_MS = 4 * 60 * 60 * 1000;
const MAXIMUM_ACTIVATION_ATTEMPTS = 5;

export type AuthenticatedCustomerSession = {
  id: string;
  restaurantId: string;
  tableSessionId: string;
  restaurantName: string;
  tableDisplayName: string;
  expiresAt: Date;
  tokenHash: string;
};

export interface CustomerServiceContract {
  getPublicTable(identifier: string): Promise<PublicTableContext>;
  getPublicMenu(identifier: string): Promise<{
    context: PublicTableContext;
    categories: Awaited<
      ReturnType<CustomerRepository["listPublicMenu"]>
    >["categories"];
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
        group: {
          id: string;
          name: string;
          minSelections: number;
          maxSelections: number;
          isRequired: boolean;
          modifiers: Array<{
            id: string;
            name: string;
            priceDeltaMinor: number;
          }>;
        };
      }>;
    }>;
  }>;
  issueActivation(
    restaurantId: string,
    tableSessionId: string,
  ): Promise<{ activationCode: string; expiresAt: string }>;
  activate(
    identifier: string,
    code: string,
  ): Promise<{ sessionToken: string; session: CustomerSession }>;
  authenticate(
    token: string | undefined,
  ): Promise<AuthenticatedCustomerSession>;
  logout(token: string | undefined): Promise<void>;
  createOrder(
    session: AuthenticatedCustomerSession,
    key: string,
    input: CustomerCreateOrderRequest,
  ): Promise<CustomerOrder>;
  listOrders(session: AuthenticatedCustomerSession): Promise<CustomerOrder[]>;
  getOrder(
    session: AuthenticatedCustomerSession,
    orderId: string,
  ): Promise<CustomerOrder>;
}

function tokenHash(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function context(record: PublicTableRecord): PublicTableContext {
  return {
    restaurant: {
      name: record.restaurant.name,
      currency: record.restaurant.currency,
    },
    table: { displayName: record.displayName, tableNumber: record.tableNumber },
    hasActiveSession: record.sessions.length > 0,
  };
}

function publicOrder(
  order: Awaited<ReturnType<OrderServiceContract["getOrder"]>>,
): CustomerOrder {
  return customerOrderSchema.parse(order);
}

export class CustomerService implements CustomerServiceContract {
  constructor(
    private readonly repository: CustomerRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly orders: OrderServiceContract,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async getPublicTable(identifier: string) {
    return context(await this.requirePublicTable(identifier));
  }

  async getPublicMenu(identifier: string) {
    const table = await this.requirePublicTable(identifier);
    const menu = await this.repository.listPublicMenu(table.restaurantId);
    return {
      context: context(table),
      categories: menu.categories,
      items: menu.items
        .filter((item) =>
          item.modifierGroups.every(
            ({ modifierGroup }) =>
              (modifierGroup.isActive || modifierGroup.minSelections === 0) &&
              (!modifierGroup.isActive ||
                modifierGroup.modifiers.length >= modifierGroup.minSelections),
          ),
        )
        .map((item) => ({
          ...item,
          modifierGroups: item.modifierGroups
            .filter(({ modifierGroup }) => modifierGroup.isActive)
            .map(({ sortOrder, modifierGroup }) => {
              const { isActive, ...publicGroup } = modifierGroup;
              void isActive;
              return {
                sortOrder,
                group: {
                  ...publicGroup,
                  isRequired: modifierGroup.minSelections > 0,
                },
              };
            }),
        })),
    };
  }

  async issueActivation(restaurantId: string, tableSessionId: string) {
    const table = await this.repository.findPublicTableForSession(
      restaurantId,
      tableSessionId,
    );
    if (
      !table ||
      !table.isActive ||
      !table.restaurant.isActive ||
      table.sessions[0]?.id !== tableSessionId
    )
      throw new AppError(
        409,
        "TABLE_SESSION_CLOSED",
        "Only an open session on an active table can issue customer access.",
      );
    const activationCode = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const expiresAt = new Date(this.now().getTime() + ACTIVATION_TTL_MS);
    await this.repository.issueActivation({
      restaurantId,
      tableSessionId,
      codeHash: await this.passwordHasher.hash(activationCode),
      expiresAt,
    });
    return { activationCode, expiresAt: expiresAt.toISOString() };
  }

  async activate(identifier: string, code: string) {
    const table = await this.requirePublicTable(identifier);
    const tableSessionId = table.sessions[0]?.id;
    if (!tableSessionId)
      throw new AppError(
        409,
        "TABLE_SESSION_CLOSED",
        "This table is not currently accepting orders.",
      );
    const activation = await this.repository.findActivation(tableSessionId);
    const now = this.now();
    if (!activation || activation.revokedAt || activation.expiresAt <= now)
      throw new AppError(
        401,
        "ACTIVATION_INVALID",
        "The activation code is invalid or expired.",
      );
    if (
      activation.lockedAt ||
      activation.failedAttempts >= MAXIMUM_ACTIVATION_ATTEMPTS
    )
      throw new AppError(
        429,
        "ACTIVATION_LOCKED",
        "Too many attempts. Ask staff for a new activation code.",
      );
    if (!(await this.passwordHasher.verify(activation.codeHash, code))) {
      await this.repository.registerFailedAttempt(
        activation.id,
        MAXIMUM_ACTIVATION_ATTEMPTS,
        now,
      );
      throw new AppError(
        401,
        "ACTIVATION_INVALID",
        "The activation code is invalid or expired.",
      );
    }
    const sessionToken = randomBytes(32).toString("base64url");
    const expiresAt = new Date(now.getTime() + CUSTOMER_SESSION_TTL_MS);
    const session = await this.repository.consumeActivation({
      activationId: activation.id,
      restaurantId: table.restaurantId,
      tableSessionId,
      tokenHash: tokenHash(sessionToken),
      expiresAt,
      now,
      maximumAttempts: MAXIMUM_ACTIVATION_ATTEMPTS,
    });
    if (!session)
      throw new AppError(
        401,
        "ACTIVATION_INVALID",
        "The activation code is invalid or expired.",
      );
    return { sessionToken, session: this.toSession(session) };
  }

  async authenticate(token: string | undefined) {
    if (!token) this.unauthenticated();
    const hash = tokenHash(token);
    const session = await this.repository.findCustomerSession(hash);
    const now = this.now();
    if (
      !session ||
      session.revokedAt ||
      session.expiresAt <= now ||
      !session.restaurant.isActive ||
      !session.tableSession.table.isActive ||
      session.tableSession.status !== "OPEN" ||
      session.tableSession.closedAt
    ) {
      if (session && !session.revokedAt)
        await this.repository.revokeCustomerSession(hash, now);
      this.unauthenticated();
    }
    if (
      !session.lastUsedAt ||
      now.getTime() - session.lastUsedAt.getTime() > 60_000
    )
      await this.repository.touchCustomerSession(session.id, now);
    return {
      id: session.id,
      restaurantId: session.restaurantId,
      tableSessionId: session.tableSessionId,
      restaurantName: session.restaurant.name,
      tableDisplayName: session.tableSession.table.displayName,
      expiresAt: session.expiresAt,
      tokenHash: hash,
    };
  }

  async logout(token: string | undefined) {
    if (token)
      await this.repository.revokeCustomerSession(tokenHash(token), this.now());
  }

  async createOrder(
    session: AuthenticatedCustomerSession,
    key: string,
    input: CustomerCreateOrderRequest,
  ) {
    return publicOrder(
      await this.orders.createCustomerOrder(
        session.restaurantId,
        session.id,
        session.tableSessionId,
        key,
        input,
      ),
    );
  }

  async listOrders(session: AuthenticatedCustomerSession) {
    return (
      await this.orders.listCustomerOrders(session.restaurantId, session.id)
    ).map(publicOrder);
  }

  async getOrder(session: AuthenticatedCustomerSession, orderId: string) {
    return publicOrder(
      await this.orders.getCustomerOrder(
        session.restaurantId,
        session.id,
        orderId,
      ),
    );
  }

  private async requirePublicTable(identifier: string) {
    const table = await this.repository.findPublicTable(identifier);
    if (!table || !table.isActive || !table.restaurant.isActive)
      throw new AppError(
        404,
        "PUBLIC_TABLE_NOT_FOUND",
        "This table menu is unavailable.",
      );
    return table;
  }

  private toSession(record: CustomerSessionRecord): CustomerSession {
    return {
      restaurantName: record.restaurant.name,
      tableDisplayName: record.tableSession.table.displayName,
      expiresAt: record.expiresAt.toISOString(),
    };
  }

  private unauthenticated(): never {
    throw new AppError(
      401,
      "CUSTOMER_SESSION_INVALID",
      "Customer ordering access has expired. Ask staff for a new code.",
    );
  }
}
