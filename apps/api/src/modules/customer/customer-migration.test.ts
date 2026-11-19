import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../../prisma/migrations/20261119180000_add_customer_qr_ordering/migration.sql",
  import.meta.url,
);

describe("customer ordering migration", () => {
  it("enforces actor, ownership, expiration, and activation invariants", async () => {
    const sql = await readFile(fileURLToPath(migrationUrl), "utf8");
    expect(sql).toContain('CONSTRAINT "Order_creator_check"');
    expect(sql).toContain('CONSTRAINT "IdempotencyKey_actor_check"');
    expect(sql).toContain('"CustomerOrderingSession_expiration_check"');
    expect(sql).toContain('"TableOrderingActivation_active_session_key"');
    expect(sql).toContain(
      'FOREIGN KEY ("tableSessionId", "restaurantId") REFERENCES "TableSession"',
    );
  });
});
