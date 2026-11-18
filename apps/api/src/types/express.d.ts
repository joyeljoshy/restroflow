import type { StaffMembership } from "@restroflow/contracts";

import type { AuthSession } from "../modules/auth/auth.service.js";

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth: AuthSession;
      restaurantAccess?: StaffMembership;
    }
  }
}

export {};
