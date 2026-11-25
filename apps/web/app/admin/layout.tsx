import type { Metadata } from "next";
import type { ReactNode } from "react";

import { ProtectedLayout } from "@/components/auth/protected-layout";
import { AppShell } from "@/components/layout/app-shell";

export const metadata: Metadata = {
  title: "Management workspace",
  robots: { index: false, follow: false, noarchive: true },
};

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <ProtectedLayout roles={["ADMIN", "MANAGER"]}>
      <AppShell role="admin">{children}</AppShell>
    </ProtectedLayout>
  );
}
