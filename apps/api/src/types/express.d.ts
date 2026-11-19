import type { StaffMembership } from "@restroflow/contracts";

import type { AuthSession } from "../modules/auth/auth.service.js";
import type { AuthenticatedCustomerSession } from "../modules/customer/customer.service.js";

declare global {
  namespace Express {
    interface Request {
      id: string;
      auth: AuthSession;
      restaurantAccess?: StaffMembership & { id: string };
      customerSession?: AuthenticatedCustomerSession;
    }
  }
}

export {};
