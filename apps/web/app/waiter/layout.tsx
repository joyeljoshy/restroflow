import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
export default function WaiterLayout({ children }: { children: ReactNode }) {
  return <AppShell role="waiter">{children}</AppShell>;
}
