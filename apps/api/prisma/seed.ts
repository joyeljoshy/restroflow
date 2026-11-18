import "dotenv/config";

import { createPrismaClient } from "../src/lib/prisma.js";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required to run the seed script.");
}

const prisma = createPrismaClient(databaseUrl);

try {
  await prisma.$queryRaw`SELECT 1`;
  console.info(
    "Database connection verified. No Part 1 domain data was seeded.",
  );
} finally {
  await prisma.$disconnect();
}
