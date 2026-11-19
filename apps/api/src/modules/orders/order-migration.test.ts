import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const orderMigration = new URL(
  "../../../prisma/migrations/20261119100000_add_transactional_orders/migration.sql",
  import.meta.url,
);
const invariantMigration = new URL(
  "../../../prisma/migrations/20261119101000_add_order_invariants/migration.sql",
  import.meta.url,
);
const kitchenMigration = new URL(
  "../../../prisma/migrations/20261119140000_add_kitchen_item_history/migration.sql",
  import.meta.url,
);

describe("transactional order migrations", () => {
  it("backs idempotency and restaurant scope with database constraints", async () => {
    const sql = await readFile(orderMigration, "utf8");
    expect(sql).toContain(
      'CREATE UNIQUE INDEX "IdempotencyKey_restaurantId_actorMembershipId_key_key"',
    );
    expect(sql).toContain('FOREIGN KEY ("tableSessionId", "restaurantId")');
    expect(sql).toContain('"responseBody" JSONB');
  });

  it("enforces monetary, version, and quantity invariants", async () => {
    const sql = await readFile(invariantMigration, "utf8");
    expect(sql).toContain('CONSTRAINT "Order_version_check"');
    expect(sql).toContain('CONSTRAINT "Order_totalMinor_check"');
    expect(sql).toContain('CONSTRAINT "OrderItem_quantity_check"');
    expect(sql).toContain('CONSTRAINT "IdempotencyKey_hash_check"');
  });

  it("scopes the item preparation audit trail to its restaurant", async () => {
    const sql = await readFile(kitchenMigration, "utf8");
    expect(sql).toContain('CREATE TABLE "OrderItemStatusHistory"');
    expect(sql).toContain('FOREIGN KEY ("orderItemId", "restaurantId")');
    expect(sql).toContain('REFERENCES "StaffMembership"("id", "restaurantId")');
  });
});
