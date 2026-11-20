import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

const migration = fileURLToPath(
  new URL(
    "../../../prisma/migrations/20261120120000_add_analytics_query_indexes/migration.sql",
    import.meta.url,
  ),
);

describe("analytics migration", () => {
  it("indexes each restaurant-scoped event timestamp used by range reports", async () => {
    const sql = await readFile(migration, "utf8");
    expect(sql).toContain('"Bill"("restaurantId", "finalizedAt")');
    expect(sql).toContain('"Payment"("restaurantId", "recordedAt")');
    expect(sql).toContain('"Order"("restaurantId", "createdAt")');
    expect(sql).toContain('"TableSession"("restaurantId", "closedAt")');
  });
});
