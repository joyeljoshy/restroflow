import "dotenv/config";

import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createPrismaClient } from "./lib/prisma.js";
import { PrismaHealthRepository } from "./modules/health/health.repository.js";

const env = loadEnvironment();
const logger = createLogger(env.LOG_LEVEL);
const prisma = createPrismaClient(env.DATABASE_URL);
const app = createApp({
  allowedOrigins: env.CORS_ORIGINS,
  healthRepository: new PrismaHealthRepository(prisma),
  logger,
});

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "RestroFlow API listening");
});

function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  server.close(() => {
    void prisma.$disconnect().then(() => process.exit(0));
  });
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
