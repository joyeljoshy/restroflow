import type { ReactNode } from "react";
import { ProtectedLayout } from "@/components/auth/protected-layout";
import { AppShell } from "@/components/layout/app-shell";
export default function WaiterLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout roles={["ADMIN", "MANAGER", "WAITER"]}>
      <AppShell role="waiter">{children}</AppShell>
    </ProtectedLayout>
  );
}
