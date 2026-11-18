import { randomUUID } from "node:crypto";

import cors from "cors";
import express, { json } from "express";
import helmet from "helmet";
import pinoHttp from "pino-http";
import type { Logger } from "pino";

import { errorHandler } from "./middleware/error-handler.js";
import { notFoundHandler } from "./middleware/not-found.js";
import { AuthController } from "./modules/auth/auth.controller.js";
import type { SessionCookieOptions } from "./modules/auth/auth.cookies.js";
import type { AuthServiceContract } from "./modules/auth/auth.service.js";
import { HealthController } from "./modules/health/health.controller.js";
import type { HealthRepository } from "./modules/health/health.repository.js";
import { HealthService } from "./modules/health/health.service.js";
import { MenuController } from "./modules/menu/menu.controller.js";
import type { MenuImageStorage } from "./modules/menu/menu-image.storage.js";
import type { MenuServiceContract } from "./modules/menu/menu.service.js";
import { RestaurantController } from "./modules/restaurants/restaurant.controller.js";
import type { RestaurantServiceContract } from "./modules/restaurants/restaurant.service.js";
import { StaffController } from "./modules/staff/staff.controller.js";
import type { StaffServiceContract } from "./modules/staff/staff.service.js";
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
  version?: string;
};

export function createApp(options: AppOptions) {
  const app = express();
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
    createV1Router(
      healthController,
      authController,
      options.authService,
      options.cookieOptions,
      options.loginRateLimitMax,
      restaurantController,
      staffController,
      menuController,
    ),
  );
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
