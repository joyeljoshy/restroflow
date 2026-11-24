import { defineConfig } from "prisma/config";

import { resolvePrismaDatasourceUrl } from "./src/config/database-target.js";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: resolvePrismaDatasourceUrl(process.env),
  },
});
