import "dotenv/config";

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // Runtime traffic can use a pooled URL while migrations retain a direct,
    // session-stable connection. Local development may use one URL for both.
    url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "",
  },
});
