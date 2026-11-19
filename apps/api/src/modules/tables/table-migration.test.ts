import { readFile } from "node:fs/promises";

import { describe, expect, it } from "vitest";

const migrationUrl = new URL(
  "../../../prisma/migrations/20261119090000_add_table_management/migration.sql",
  import.meta.url,
);

describe("table management migration", () => {
  it("enforces session concurrency and lifecycle invariants in PostgreSQL", async () => {
    const sql = await readFile(migrationUrl, "utf8");

    expect(sql).toContain(
      'CREATE UNIQUE INDEX "TableSession_one_open_per_table_key"',
    );
    expect(sql).toContain('WHERE "closedAt" IS NULL');
    expect(sql).toContain('CONSTRAINT "TableSession_status_dates_check"');
    expect(sql).toContain('CONSTRAINT "RestaurantTable_capacity_check"');
  });
});
