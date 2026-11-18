import type { ReactNode } from "react";
import { ProtectedLayout } from "@/components/auth/protected-layout";
import { AppShell } from "@/components/layout/app-shell";
export default function KitchenLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout roles={["ADMIN", "MANAGER", "KITCHEN"]}>
      <AppShell role="kitchen">{children}</AppShell>
    </ProtectedLayout>
  );
}
