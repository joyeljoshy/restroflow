import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProtectedLayout } from "@/components/auth/protected-layout";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Kitchen display",
  robots: { index: false, follow: false, noarchive: true },
};

export default function KitchenLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout roles={["ADMIN", "MANAGER", "KITCHEN"]}>
      <AppShell role="kitchen">{children}</AppShell>
    </ProtectedLayout>
  );
}
