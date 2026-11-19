import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../../prisma/migrations/20261119181225_enforce_billing_invariants/migration.sql",
  import.meta.url,
);

describe("billing migration", () => {
  it("enforces financial and lifecycle invariants in PostgreSQL", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toContain('CONSTRAINT "Bill_money_nonnegative"');
    expect(sql).toContain('CONSTRAINT "Bill_status_balance_consistent"');
    expect(sql).toContain('CONSTRAINT "BillItem_subtotal_consistent"');
    expect(sql).toContain('CONSTRAINT "Payment_amount_positive"');
    expect(sql).toContain('CONSTRAINT "PaymentIdempotency_expiration_valid"');
  });
});
