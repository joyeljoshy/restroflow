import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProtectedLayout } from "@/components/auth/protected-layout";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Cashier workspace",
  robots: { index: false, follow: false, noarchive: true },
};

export default function CashierLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout roles={["ADMIN", "MANAGER", "CASHIER"]}>
      <AppShell role="cashier">{children}</AppShell>
    </ProtectedLayout>
  );
}
