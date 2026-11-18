import type { ReactNode } from "react";

import { ProtectedLayout } from "@/components/auth/protected-layout";
import { AppShell } from "@/components/layout/app-shell";

export default function CashierLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout roles={["ADMIN", "MANAGER", "CASHIER"]}>
      <AppShell role="cashier">{children}</AppShell>
    </ProtectedLayout>
  );
}
