import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProtectedLayout } from "@/components/auth/protected-layout";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Waiter workspace",
  robots: { index: false, follow: false, noarchive: true },
};

export default function WaiterLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout roles={["ADMIN", "MANAGER", "WAITER"]}>
      <AppShell role="waiter">{children}</AppShell>
    </ProtectedLayout>
  );
}
