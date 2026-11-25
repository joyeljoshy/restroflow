import { randomUUID } from "node:crypto";

import cors from "cors";
import express, { json } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import type { Logger } from "pino";

import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { requireTrustedOrigin } from "./middleware/trusted-origin.js";
import { AnalyticsController } from "./modules/analytics/analytics.controller.js";
import type { AnalyticsServiceContract } from "./modules/analytics/analytics.service.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import type { SessionCookieOptions } from "./modules/auth/auth.cookies.js";
import type { AuthServiceContract } from "./modules/auth/auth.service.js";
import { BillingController } from "./modules/billing/billing.controller.js";
import type { BillingServiceContract } from "./modules/billing/billing.service.js";
import { HealthController } from "./modules/health/health.controller.js";
import { CustomerController } from "./modules/customer/customer.controller.js";
import type { CustomerServiceContract } from "./modules/customer/customer.service.js";
import type { HealthRepository } from "./modules/health/health.repository.js";
import { HealthService } from "./modules/health/health.service.js";
import { MenuController } from "./modules/menu/menu.controller.js";
import type { MenuImageStorage } from "./modules/menu/menu-image.storage.js";
import type { MenuServiceContract } from "./modules/menu/menu.service.js";
import { OrderController } from "./modules/orders/order.controller.js";
import type { OrderServiceContract } from "./modules/orders/order.service.js";
import { RestaurantController } from "./modules/restaurants/restaurant.controller.js";
import type { RestaurantServiceContract } from "./modules/restaurants/restaurant.service.js";
import { StaffController } from "./modules/staff/staff.controller.js";
import type { StaffServiceContract } from "./modules/staff/staff.service.js";
import { TableController } from "./modules/tables/table.controller.js";
import type { TableServiceContract } from "./modules/tables/table.service.js";
import { createV1Router } from "./routes/v1.js";

type AppOptions = {
  allowedOrigins: string[];
  authService: AuthServiceContract;
  cookieOptions: SessionCookieOptions;
  healthRepository: HealthRepository;
  loginRateLimitMax: number;
  logger: Logger;
  restaurantService: RestaurantServiceContract;
  staffService: StaffServiceContract;
  menuService?: MenuServiceContract;
  menuImageStorage?: MenuImageStorage;
  menuImageDirectory?: string;
  tableService?: TableServiceContract;
  orderService?: OrderServiceContract;
  customerService?: CustomerServiceContract;
  billingService?: BillingServiceContract;
  analyticsService?: AnalyticsServiceContract;
  customerCookieOptions?: SessionCookieOptions;
  customerProxySecret?: string;
  trustProxyHops?: number;
  version?: string;
};

export function createApp(options: AppOptions) {
  const app = express();
  if ((options.trustProxyHops ?? 0) > 0) {
    app.set("trust proxy", options.trustProxyHops);
  }
  const healthService = new HealthService(
    options.healthRepository,
    options.version ?? "0.1.0",
  );
  const healthController = new HealthController(healthService);
  const authController = new AuthController(
    options.authService,
    options.cookieOptions,
  );
  const restaurantController = new RestaurantController(
    options.restaurantService,
  );
  const staffController = new StaffController(options.staffService);
  const menuController = options.menuService
    ? new MenuController(options.menuService, options.menuImageStorage)
    : undefined;
  const tableController = options.tableService
    ? new TableController(options.tableService)
    : undefined;
  const orderController = options.orderService
    ? new OrderController(options.orderService)
    : undefined;
  const customerController =
    options.customerService && options.customerCookieOptions
      ? new CustomerController(
          options.customerService,
          options.customerCookieOptions,
        )
      : undefined;
  const billingController = options.billingService
    ? new BillingController(options.billingService)
    : undefined;
  const analyticsController = options.analyticsService
    ? new AnalyticsController(options.analyticsService)
    : undefined;

  app.disable("x-powered-by");
  app.use(helmet());
  app.use(
    cors({
      credentials: true,
      origin(origin, callback) {
        if (!origin || options.allowedOrigins.includes(origin))
          return callback(null, true);
        return callback(null, false);
      },
    }),
  );
  app.use(json({ limit: "1mb" }));
  if (options.menuImageDirectory) {
    app.use(
      "/uploads/menu",
      (_req, res, next) => {
        // Menu images are intentionally embedded by the separately hosted web app.
        // Keep Helmet's same-origin policy everywhere else.
        res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
        next();
      },
      express.static(options.menuImageDirectory, {
        dotfiles: "deny",
        index: false,
        maxAge: "1d",
      }),
    );
  }
  app.use(
    pinoHttp({
      logger: options.logger,
      genReqId(req, res) {
        const incomingId = req.headers["x-request-id"];
        const id =
          typeof incomingId === "string" && incomingId.length <= 128
            ? incomingId
            : randomUUID();
        res.setHeader("x-request-id", id);
        return id;
      },
    }),
  );

  app.use(
    "/api/v1",
    requireTrustedOrigin(options.allowedOrigins),
    createV1Router(
      healthController,
      authController,
      options.authService,
      options.cookieOptions,
      options.loginRateLimitMax,
      restaurantController,
      staffController,
      menuController,
      tableController,
      orderController,
      customerController,
      options.customerService,
      options.customerCookieOptions,
      options.allowedOrigins,
      billingController,
      analyticsController,
      options.customerProxySecret,
    ),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
