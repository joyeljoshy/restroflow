import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
export default function KitchenLayout({ children }: { children: ReactNode }) {
  return <AppShell role="kitchen">{children}</AppShell>;
}
