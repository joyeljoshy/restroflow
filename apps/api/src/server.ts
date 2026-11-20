import "dotenv/config";

import path from "node:path";
import { createServer } from "node:http";

import { createApp } from "./app.js";
import { loadEnvironment } from "./config/env.js";
import { createLogger } from "./lib/logger.js";
import { createPrismaClient } from "./lib/prisma.js";
import { PrismaAuthRepository } from "./modules/auth/auth.repository.js";
import { PrismaAnalyticsRepository } from "./modules/analytics/analytics.repository.js";
import { AnalyticsService } from "./modules/analytics/analytics.service.js";
import {
  Argon2PasswordHasher,
  AuthService,
} from "./modules/auth/auth.service.js";
import { PrismaHealthRepository } from "./modules/health/health.repository.js";
import { PrismaCustomerRepository } from "./modules/customer/customer.repository.js";
import { CustomerService } from "./modules/customer/customer.service.js";
import { PrismaBillingRepository } from "./modules/billing/billing.repository.js";
import { BillingService } from "./modules/billing/billing.service.js";
import { LocalMenuImageStorage } from "./modules/menu/menu-image.storage.js";
import { PrismaMenuRepository } from "./modules/menu/menu.repository.js";
import { MenuService } from "./modules/menu/menu.service.js";
import { PrismaOrderRepository } from "./modules/orders/order.repository.js";
import { OrderService } from "./modules/orders/order.service.js";
import {
  createRealtimeServer,
  SocketIoRealtimePublisher,
} from "./modules/realtime/realtime.server.js";
import { PrismaRestaurantRepository } from "./modules/restaurants/restaurant.repository.js";
import { RestaurantService } from "./modules/restaurants/restaurant.service.js";
import { PrismaStaffRepository } from "./modules/staff/staff.repository.js";
import { StaffService } from "./modules/staff/staff.service.js";
import { PrismaTableRepository } from "./modules/tables/table.repository.js";
import { TableService } from "./modules/tables/table.service.js";

const env = loadEnvironment();
const logger = createLogger(env.LOG_LEVEL);
const prisma = createPrismaClient(env.DATABASE_URL);
const sessionTtlMs = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
const authService = new AuthService(
  new PrismaAuthRepository(prisma),
  new Argon2PasswordHasher(),
  sessionTtlMs,
);
const passwordHasher = new Argon2PasswordHasher();
const menuImageDirectory = path.resolve(env.MENU_IMAGE_DIRECTORY);
const orderRepository = new PrismaOrderRepository(prisma);
const realtimePublisher = new SocketIoRealtimePublisher();
const orderService = new OrderService(orderRepository, realtimePublisher);
const billingService = new BillingService(
  new PrismaBillingRepository(prisma),
  realtimePublisher,
);
const analyticsService = new AnalyticsService(
  new PrismaAnalyticsRepository(prisma),
);
const customerService = new CustomerService(
  new PrismaCustomerRepository(prisma),
  passwordHasher,
  orderService,
);
const app = createApp({
  allowedOrigins: env.CORS_ORIGINS,
  authService,
  cookieOptions: {
    secure: env.NODE_ENV === "production",
    maxAgeMs: sessionTtlMs,
  },
  healthRepository: new PrismaHealthRepository(prisma),
  loginRateLimitMax: env.LOGIN_RATE_LIMIT_MAX,
  logger,
  restaurantService: new RestaurantService(
    new PrismaRestaurantRepository(prisma),
  ),
  staffService: new StaffService(
    new PrismaStaffRepository(prisma),
    passwordHasher,
  ),
  menuService: new MenuService(new PrismaMenuRepository(prisma)),
  menuImageStorage: new LocalMenuImageStorage(menuImageDirectory),
  menuImageDirectory,
  tableService: new TableService(
    new PrismaTableRepository(prisma),
    env.PUBLIC_WEB_ORIGIN,
  ),
  orderService,
  customerService,
  billingService,
  analyticsService,
  customerCookieOptions: {
    secure: env.NODE_ENV === "production",
    maxAgeMs: 4 * 60 * 60 * 1000,
  },
});

const server = createServer(app);
const realtimeServer = createRealtimeServer(server, {
  allowedOrigins: env.CORS_ORIGINS,
  authService,
  customerService,
});
realtimePublisher.attach(realtimeServer, authService, customerService);

server.listen(env.PORT, () => {
  logger.info({ port: env.PORT }, "RestroFlow API listening");
});

async function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down");
  await realtimeServer.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
