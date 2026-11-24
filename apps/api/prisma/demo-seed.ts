import "dotenv/config";

import { createHash } from "node:crypto";

import { requireDemoSeedDatabaseUrl } from "../src/config/database-target.js";
import { createPrismaClient } from "../src/lib/prisma.js";
import { Argon2PasswordHasher } from "../src/modules/auth/auth.service.js";
import { demoSeedTransactionOptions } from "./demo-seed.config.js";

const restaurantId = "12000000-0000-4000-8000-000000000001";
const restaurantSlug = "the-urban-table-demo";

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value)
    throw new Error(`${name} is required for the explicit demo seed.`);
  return value;
}

function demoIdentifier(value: string): string {
  return createHash("sha256")
    .update(`restroflow-demo:${value}`)
    .digest("base64url");
}

function daysAgo(days: number, hour: number): Date {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() - days);
  value.setUTCHours(hour, 0, 0, 0);
  return value;
}

const databaseLabel = required("DEMO_SEED_DATABASE_LABEL");
const environment = required("DEMO_SEED_ENVIRONMENT");
const confirmation = required("DEMO_SEED_CONFIRM");

if (!["local", "production-demo"].includes(environment)) {
  throw new Error("DEMO_SEED_ENVIRONMENT must be local or production-demo.");
}
if (confirmation !== "CREATE_THE_URBAN_TABLE") {
  throw new Error("DEMO_SEED_CONFIRM must equal CREATE_THE_URBAN_TABLE.");
}
if (
  process.env.NODE_ENV === "production" &&
  environment !== "production-demo"
) {
  throw new Error(
    "Production demo seeding requires DEMO_SEED_ENVIRONMENT=production-demo.",
  );
}

const databaseUrl = requireDemoSeedDatabaseUrl(process.env, environment);
const roles = ["ADMIN", "MANAGER", "WAITER", "KITCHEN", "CASHIER"] as const;
const passwords = Object.fromEntries(
  roles.map((role) => [role, required(`DEMO_SEED_${role}_PASSWORD`)]),
) as Record<(typeof roles)[number], string>;
if (Object.values(passwords).some((password) => password.length < 16)) {
  throw new Error("Every demo password must contain at least 16 characters.");
}
if (new Set(Object.values(passwords)).size !== roles.length) {
  throw new Error("Each demo role must use a distinct password.");
}

const ids = {
  users: Object.fromEntries(
    roles.map((role, index) => [
      role,
      `12000001-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ]),
  ) as Record<(typeof roles)[number], string>,
  memberships: Object.fromEntries(
    roles.map((role, index) => [
      role,
      `12000002-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
    ]),
  ) as Record<(typeof roles)[number], string>,
  categories: {
    starters: "12000003-0000-4000-8000-000000000001",
    mains: "12000003-0000-4000-8000-000000000002",
    drinks: "12000003-0000-4000-8000-000000000003",
  },
  items: {
    tikka: "12000004-0000-4000-8000-000000000001",
    kebab: "12000004-0000-4000-8000-000000000002",
    paneer: "12000004-0000-4000-8000-000000000003",
    biryani: "12000004-0000-4000-8000-000000000004",
    dal: "12000004-0000-4000-8000-000000000005",
    soda: "12000004-0000-4000-8000-000000000006",
    lassi: "12000004-0000-4000-8000-000000000007",
  },
  modifierGroup: "12000005-0000-4000-8000-000000000001",
  modifiers: {
    mild: "12000006-0000-4000-8000-000000000001",
    medium: "12000006-0000-4000-8000-000000000002",
    spicy: "12000006-0000-4000-8000-000000000003",
  },
  tables: Array.from(
    { length: 6 },
    (_, index) =>
      `12000008-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
  ),
  sessions: {
    paid: "12000009-0000-4000-8000-000000000001",
    partial: "12000009-0000-4000-8000-000000000002",
    kitchen: "12000009-0000-4000-8000-000000000003",
  },
  orders: {
    paid: "1200000a-0000-4000-8000-000000000001",
    partial: "1200000a-0000-4000-8000-000000000002",
    kitchen: "1200000a-0000-4000-8000-000000000003",
  },
  orderItems: {
    paneer: "1200000b-0000-4000-8000-000000000001",
    soda: "1200000b-0000-4000-8000-000000000002",
    biryani: "1200000b-0000-4000-8000-000000000003",
    tikka: "1200000b-0000-4000-8000-000000000004",
    dal: "1200000b-0000-4000-8000-000000000005",
  },
  bills: {
    paid: "1200000c-0000-4000-8000-000000000001",
    partial: "1200000c-0000-4000-8000-000000000002",
  },
};

const now = new Date();
const paidOpenedAt = daysAgo(8, 13);
const paidClosedAt = daysAgo(8, 15);
const partialOpenedAt = daysAgo(1, 13);
const kitchenOpenedAt = daysAgo(0, 12);
const prisma = createPrismaClient(databaseUrl);

try {
  await prisma.$queryRaw`SELECT 1`;
  const existing = await prisma.restaurant.findUnique({
    where: { slug: restaurantSlug },
  });
  if (existing && existing.id !== restaurantId) {
    throw new Error(
      `Refusing to seed: ${restaurantSlug} already belongs to a non-demo restaurant.`,
    );
  }

  const hasher = new Argon2PasswordHasher();
  const passwordHashes = Object.fromEntries(
    await Promise.all(
      roles.map(async (role) => [role, await hasher.hash(passwords[role])]),
    ),
  ) as Record<(typeof roles)[number], string>;

  await prisma.$transaction(async (tx) => {
    await tx.restaurant.upsert({
      where: { id: restaurantId },
      update: {
        name: "The Urban Table",
        address: "42 Demo Avenue, Bengaluru",
        phone: "+91 80000 00000",
        email: "hello@theurbantable.example",
        timezone: "Asia/Kolkata",
        currency: "INR",
        taxName: "GST",
        taxRateBasisPoints: 500,
        pricesIncludeTax: false,
        isActive: true,
      },
      create: {
        id: restaurantId,
        slug: restaurantSlug,
        name: "The Urban Table",
        address: "42 Demo Avenue, Bengaluru",
        phone: "+91 80000 00000",
        email: "hello@theurbantable.example",
        timezone: "Asia/Kolkata",
        currency: "INR",
        taxName: "GST",
        taxRateBasisPoints: 500,
      },
    });

    for (const role of roles) {
      const label = role.charAt(0) + role.slice(1).toLowerCase();
      await tx.user.upsert({
        where: { id: ids.users[role] },
        update: { passwordHash: passwordHashes[role], isActive: true },
        create: {
          id: ids.users[role],
          email: `${role.toLowerCase()}@theurbantable.example`,
          displayName: `Demo ${label}`,
          passwordHash: passwordHashes[role],
        },
      });
      await tx.staffMembership.upsert({
        where: { id: ids.memberships[role] },
        update: { role, isActive: true },
        create: {
          id: ids.memberships[role],
          userId: ids.users[role],
          restaurantId,
          role,
        },
      });
    }

    const categories = [
      [ids.categories.starters, "Small Plates", "Shareable starters", 1],
      [ids.categories.mains, "Mains", "Comforting Indian favourites", 2],
      [ids.categories.drinks, "Drinks", "House-made coolers", 3],
    ] as const;
    for (const [id, name, description, sortOrder] of categories) {
      await tx.menuCategory.upsert({
        where: { id },
        update: { name, description, sortOrder, isActive: true },
        create: { id, restaurantId, name, description, sortOrder },
      });
    }

    const items = [
      [
        ids.items.tikka,
        ids.categories.starters,
        "Tandoori Mushroom Tikka",
        28000,
        true,
      ],
      [
        ids.items.kebab,
        ids.categories.starters,
        "Smoked Chicken Kebab",
        36000,
        false,
      ],
      [ids.items.paneer, ids.categories.mains, "Paneer Lababdar", 32000, true],
      [
        ids.items.biryani,
        ids.categories.mains,
        "Dum Chicken Biryani",
        55000,
        false,
      ],
      [ids.items.dal, ids.categories.mains, "Dal Makhani", 26000, true],
      [ids.items.soda, ids.categories.drinks, "Masala Soda", 12000, true],
      [ids.items.lassi, ids.categories.drinks, "Saffron Lassi", 16000, true],
    ] as const;
    for (const [id, categoryId, name, priceMinor, isVegetarian] of items) {
      await tx.menuItem.upsert({
        where: { id },
        update: {
          name,
          priceMinor,
          isVegetarian,
          isAvailable: true,
          isActive: true,
        },
        create: {
          id,
          restaurantId,
          categoryId,
          name,
          description: "Prepared fresh to order with house spices.",
          priceMinor,
          isVegetarian,
        },
      });
    }

    await tx.modifierGroup.upsert({
      where: { id: ids.modifierGroup },
      update: { isActive: true },
      create: {
        id: ids.modifierGroup,
        restaurantId,
        name: "Spice level",
        minSelections: 1,
        maxSelections: 1,
      },
    });
    for (const [id, name] of Object.entries({
      [ids.modifiers.mild]: "Mild",
      [ids.modifiers.medium]: "Medium",
      [ids.modifiers.spicy]: "Spicy",
    })) {
      await tx.modifier.upsert({
        where: { id },
        update: { name, isAvailable: true },
        create: { id, modifierGroupId: ids.modifierGroup, name },
      });
    }
    for (const [index, menuItemId] of [
      ids.items.tikka,
      ids.items.kebab,
      ids.items.paneer,
      ids.items.biryani,
    ].entries()) {
      await tx.menuItemModifierGroup.upsert({
        where: {
          menuItemId_modifierGroupId: {
            menuItemId,
            modifierGroupId: ids.modifierGroup,
          },
        },
        update: { sortOrder: 0 },
        create: {
          id: `12000007-0000-4000-8000-${String(index + 1).padStart(12, "0")}`,
          restaurantId,
          menuItemId,
          modifierGroupId: ids.modifierGroup,
        },
      });
    }

    for (const [index, id] of ids.tables.entries()) {
      await tx.restaurantTable.upsert({
        where: { id },
        update: { isActive: true },
        create: {
          id,
          restaurantId,
          tableNumber: String(index + 1),
          displayName: index < 4 ? `Dining ${index + 1}` : `Patio ${index - 3}`,
          capacity: index % 3 === 0 ? 6 : index % 2 === 0 ? 4 : 2,
          qrIdentifier: demoIdentifier(`table-${index + 1}`),
        },
      });
    }

    const sessions = [
      {
        id: ids.sessions.paid,
        tableId: ids.tables[0]!,
        status: "CLOSED" as const,
        openedAt: paidOpenedAt,
        closedAt: paidClosedAt,
        closedByMembershipId: ids.memberships.CASHIER,
      },
      {
        id: ids.sessions.partial,
        tableId: ids.tables[1]!,
        status: "OPEN" as const,
        openedAt: partialOpenedAt,
        closedAt: null,
        closedByMembershipId: null,
      },
      {
        id: ids.sessions.kitchen,
        tableId: ids.tables[2]!,
        status: "OPEN" as const,
        openedAt: kitchenOpenedAt,
        closedAt: null,
        closedByMembershipId: null,
      },
    ];
    for (const session of sessions) {
      await tx.tableSession.upsert({
        where: { id: session.id },
        update: {},
        create: {
          ...session,
          restaurantId,
          openedByMembershipId: ids.memberships.WAITER,
          createdAt: session.openedAt,
        },
      });
    }

    const orders = [
      {
        id: ids.orders.paid,
        tableSessionId: ids.sessions.paid,
        orderNumber: "DEMO-1001",
        status: "SERVED" as const,
        version: 5,
        totalMinor: 98000,
        createdAt: paidOpenedAt,
      },
      {
        id: ids.orders.partial,
        tableSessionId: ids.sessions.partial,
        orderNumber: "DEMO-1002",
        status: "SERVED" as const,
        version: 5,
        totalMinor: 55000,
        createdAt: partialOpenedAt,
      },
      {
        id: ids.orders.kitchen,
        tableSessionId: ids.sessions.kitchen,
        orderNumber: "DEMO-1003",
        status: "PREPARING" as const,
        version: 3,
        totalMinor: 54000,
        createdAt: kitchenOpenedAt,
      },
    ];
    for (const order of orders) {
      await tx.order.upsert({
        where: { id: order.id },
        update: {},
        create: {
          ...order,
          restaurantId,
          source: "WAITER",
          createdByMembershipId: ids.memberships.WAITER,
        },
      });
    }

    const orderItems = [
      [
        ids.orderItems.paneer,
        ids.orders.paid,
        ids.items.paneer,
        "Paneer Lababdar",
        2,
        32000,
        74000,
        "SERVED",
        paidOpenedAt,
      ],
      [
        ids.orderItems.soda,
        ids.orders.paid,
        ids.items.soda,
        "Masala Soda",
        2,
        12000,
        24000,
        "SERVED",
        paidOpenedAt,
      ],
      [
        ids.orderItems.biryani,
        ids.orders.partial,
        ids.items.biryani,
        "Dum Chicken Biryani",
        1,
        55000,
        55000,
        "SERVED",
        partialOpenedAt,
      ],
      [
        ids.orderItems.tikka,
        ids.orders.kitchen,
        ids.items.tikka,
        "Tandoori Mushroom Tikka",
        1,
        28000,
        28000,
        "READY",
        kitchenOpenedAt,
      ],
      [
        ids.orderItems.dal,
        ids.orders.kitchen,
        ids.items.dal,
        "Dal Makhani",
        1,
        26000,
        26000,
        "PREPARING",
        kitchenOpenedAt,
      ],
    ] as const;
    for (const [
      id,
      orderId,
      menuItemId,
      itemNameSnapshot,
      quantity,
      unitPriceMinor,
      lineTotalMinor,
      status,
      createdAt,
    ] of orderItems) {
      await tx.orderItem.upsert({
        where: { id },
        update: {},
        create: {
          id,
          orderId,
          restaurantId,
          menuItemId,
          itemNameSnapshot,
          quantity,
          unitPriceMinor,
          lineTotalMinor,
          status,
          createdAt,
        },
      });
    }
    await tx.orderItemModifier.upsert({
      where: { id: "1200000d-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "1200000d-0000-4000-8000-000000000001",
        orderItemId: ids.orderItems.paneer,
        modifierGroupId: ids.modifierGroup,
        modifierId: ids.modifiers.medium,
        modifierGroupNameSnapshot: "Spice level",
        modifierNameSnapshot: "Medium",
        modifierPriceMinor: 5000,
        quantity: 1,
      },
    });

    await tx.bill.upsert({
      where: { id: ids.bills.paid },
      update: {},
      create: {
        id: ids.bills.paid,
        restaurantId,
        tableSessionId: ids.sessions.paid,
        billNumber: "BILL-DEMO-1001",
        status: "PAID",
        version: 2,
        currency: "INR",
        taxName: "GST",
        taxRateBasisPoints: 500,
        pricesIncludeTax: false,
        roundingPolicy: "HALF_UP_PER_LINE",
        subtotalMinor: 98000,
        taxMinor: 4900,
        totalMinor: 102900,
        amountPaidMinor: 102900,
        createdByMembershipId: ids.memberships.CASHIER,
        finalizedByMembershipId: ids.memberships.CASHIER,
        createdAt: paidOpenedAt,
        finalizedAt: paidOpenedAt,
      },
    });
    await tx.bill.upsert({
      where: { id: ids.bills.partial },
      update: {},
      create: {
        id: ids.bills.partial,
        restaurantId,
        tableSessionId: ids.sessions.partial,
        billNumber: "BILL-DEMO-1002",
        status: "PARTIALLY_PAID",
        version: 2,
        currency: "INR",
        taxName: "GST",
        taxRateBasisPoints: 500,
        pricesIncludeTax: false,
        roundingPolicy: "HALF_UP_PER_LINE",
        subtotalMinor: 55000,
        taxMinor: 2750,
        totalMinor: 57750,
        amountPaidMinor: 20000,
        createdByMembershipId: ids.memberships.CASHIER,
        finalizedByMembershipId: ids.memberships.CASHIER,
        createdAt: partialOpenedAt,
        finalizedAt: partialOpenedAt,
      },
    });

    const billItems = [
      [
        "1200000e-0000-4000-8000-000000000001",
        ids.bills.paid,
        ids.orderItems.paneer,
        "DEMO-1001",
        "Paneer Lababdar",
        2,
        32000,
        5000,
        74000,
        3700,
        77700,
      ],
      [
        "1200000e-0000-4000-8000-000000000002",
        ids.bills.paid,
        ids.orderItems.soda,
        "DEMO-1001",
        "Masala Soda",
        2,
        12000,
        0,
        24000,
        1200,
        25200,
      ],
      [
        "1200000e-0000-4000-8000-000000000003",
        ids.bills.partial,
        ids.orderItems.biryani,
        "DEMO-1002",
        "Dum Chicken Biryani",
        1,
        55000,
        0,
        55000,
        2750,
        57750,
      ],
    ] as const;
    for (const [
      id,
      billId,
      sourceOrderItemId,
      orderNumberSnapshot,
      itemNameSnapshot,
      quantity,
      unitPriceMinor,
      modifierSubtotalMinor,
      lineSubtotalMinor,
      taxAmountMinor,
      finalLineAmountMinor,
    ] of billItems) {
      await tx.billItem.upsert({
        where: { id },
        update: {},
        create: {
          id,
          restaurantId,
          billId,
          sourceOrderItemId,
          orderNumberSnapshot,
          itemNameSnapshot,
          quantity,
          unitPriceMinor,
          modifierSubtotalMinor,
          lineSubtotalMinor,
          taxAmountMinor,
          finalLineAmountMinor,
          batchNumber: 1,
        },
      });
    }
    await tx.billItemModifier.upsert({
      where: { id: "12000011-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "12000011-0000-4000-8000-000000000001",
        restaurantId,
        billItemId: "1200000e-0000-4000-8000-000000000001",
        modifierGroupNameSnapshot: "Spice level",
        modifierNameSnapshot: "Medium",
        modifierPriceMinor: 5000,
        quantity: 1,
      },
    });

    await tx.payment.upsert({
      where: { id: "1200000f-0000-4000-8000-000000000001" },
      update: {},
      create: {
        id: "1200000f-0000-4000-8000-000000000001",
        restaurantId,
        billId: ids.bills.paid,
        amountMinor: 102900,
        method: "UPI",
        reference: "DEMO-UPI-1001",
        note: "Synthetic demo payment; not gateway verified",
        recordedByMembershipId: ids.memberships.CASHIER,
        recordedAt: paidClosedAt,
      },
    });
    await tx.payment.upsert({
      where: { id: "1200000f-0000-4000-8000-000000000002" },
      update: {},
      create: {
        id: "1200000f-0000-4000-8000-000000000002",
        restaurantId,
        billId: ids.bills.partial,
        amountMinor: 20000,
        method: "CASH",
        note: "Synthetic partial payment",
        recordedByMembershipId: ids.memberships.CASHIER,
        recordedAt: now,
      },
    });

    const historyStatuses = [
      "PENDING",
      "ACCEPTED",
      "PREPARING",
      "READY",
      "SERVED",
    ] as const;
    for (const [orderIndex, order] of orders.slice(0, 2).entries()) {
      for (const [statusIndex, newStatus] of historyStatuses.entries()) {
        await tx.orderStatusHistory.upsert({
          where: {
            id: `12000010-0000-4000-${String(orderIndex + 1).padStart(4, "0")}-${String(statusIndex + 1).padStart(12, "0")}`,
          },
          update: {},
          create: {
            id: `12000010-0000-4000-${String(orderIndex + 1).padStart(4, "0")}-${String(statusIndex + 1).padStart(12, "0")}`,
            orderId: order.id,
            restaurantId,
            previousStatus:
              statusIndex === 0 ? null : historyStatuses[statusIndex - 1],
            newStatus,
            actorMembershipId:
              statusIndex >= 1 && statusIndex <= 3
                ? ids.memberships.KITCHEN
                : ids.memberships.WAITER,
            createdAt: new Date(
              order.createdAt.getTime() + statusIndex * 10 * 60_000,
            ),
          },
        });
      }
    }
    const kitchenOrderStatuses = ["PENDING", "ACCEPTED", "PREPARING"] as const;
    for (const [statusIndex, newStatus] of kitchenOrderStatuses.entries()) {
      await tx.orderStatusHistory.upsert({
        where: {
          id: `12000012-0000-4000-8000-${String(statusIndex + 1).padStart(12, "0")}`,
        },
        update: {},
        create: {
          id: `12000012-0000-4000-8000-${String(statusIndex + 1).padStart(12, "0")}`,
          orderId: ids.orders.kitchen,
          restaurantId,
          previousStatus:
            statusIndex === 0 ? null : kitchenOrderStatuses[statusIndex - 1],
          newStatus,
          actorMembershipId:
            statusIndex === 0
              ? ids.memberships.WAITER
              : ids.memberships.KITCHEN,
          createdAt: new Date(
            kitchenOpenedAt.getTime() + statusIndex * 10 * 60_000,
          ),
        },
      });
    }
    for (const [itemIndex, item] of [
      {
        id: ids.orderItems.tikka,
        statuses: ["PENDING", "PREPARING", "READY"] as const,
      },
      { id: ids.orderItems.dal, statuses: ["PENDING", "PREPARING"] as const },
    ].entries()) {
      for (const [statusIndex, newStatus] of item.statuses.entries()) {
        await tx.orderItemStatusHistory.upsert({
          where: {
            id: `12000013-0000-4000-${String(itemIndex + 1).padStart(4, "0")}-${String(statusIndex + 1).padStart(12, "0")}`,
          },
          update: {},
          create: {
            id: `12000013-0000-4000-${String(itemIndex + 1).padStart(4, "0")}-${String(statusIndex + 1).padStart(12, "0")}`,
            orderItemId: item.id,
            restaurantId,
            previousStatus:
              statusIndex === 0 ? null : item.statuses[statusIndex - 1],
            newStatus,
            actorMembershipId: ids.memberships.KITCHEN,
            createdAt: new Date(
              kitchenOpenedAt.getTime() + statusIndex * 8 * 60_000,
            ),
          },
        });
      }
    }
  }, demoSeedTransactionOptions);

  console.info(
    `Demo seed prepared The Urban Table in ${databaseLabel} (${environment}). No credentials were printed.`,
  );
} finally {
  await prisma.$disconnect();
}
