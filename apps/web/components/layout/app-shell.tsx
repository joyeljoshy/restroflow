"use client";

import {
  BarChart3,
  Bell,
  ChefHat,
  LayoutDashboard,
  Menu,
  Settings,
  ShoppingBag,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/stores/ui-store";

const roleConfig = {
  admin: {
    label: "Admin",
    items: [
      ["Overview", "/admin", LayoutDashboard],
      ["Team", "/admin#team", Users],
      ["Analytics", "/admin#analytics", BarChart3],
      ["Settings", "/admin#settings", Settings],
    ],
  },
  kitchen: {
    label: "Kitchen",
    items: [
      ["Order board", "/kitchen", ChefHat],
      ["All orders", "/kitchen#orders", ShoppingBag],
    ],
  },
  waiter: {
    label: "Waiter",
    items: [
      ["Service floor", "/waiter", LayoutDashboard],
      ["Orders", "/waiter#orders", ShoppingBag],
    ],
  },
} as const;

export type WorkspaceRole = keyof typeof roleConfig;

export function AppShell({
  role,
  children,
}: {
  role: WorkspaceRole;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const { navigationOpen, toggleNavigation, closeNavigation } = useUiStore();
  const config = roleConfig[role];

  const sidebar = (
    <>
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/" onClick={closeNavigation}>
          <Logo />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={closeNavigation}
          aria-label="Close navigation"
        >
          <X />
        </Button>
      </div>
      <div className="px-4 py-4">
        <p className="text-muted-foreground px-3 text-[11px] font-bold tracking-[.16em] uppercase">
          {config.label} workspace
        </p>
        <nav
          className="mt-3 space-y-1"
          aria-label={`${config.label} workspace navigation`}
        >
          {config.items.map(([label, href, Icon]) => {
            const active = pathname === href;
            return (
              <Link
                key={label}
                href={href}
                onClick={closeNavigation}
                className={cn(
                  "text-muted-foreground hover:bg-muted hover:text-foreground flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active && "bg-accent text-accent-foreground",
                )}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="mt-auto border-t p-4">
        <div className="bg-muted/60 rounded-xl p-3">
          <p className="text-sm font-semibold">Part 1 foundation</p>
          <p className="text-muted-foreground mt-1 text-xs leading-5">
            Role authorization and live operational data are not enabled yet.
          </p>
        </div>
      </div>
    </>
  );

  return (
    <div className="bg-muted/30 min-h-screen">
      <aside className="bg-card fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r lg:flex">
        {sidebar}
      </aside>
      {navigationOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            className="absolute inset-0 bg-black/35"
            onClick={closeNavigation}
            aria-label="Close navigation overlay"
          />
          <aside className="bg-card relative flex h-full w-72 flex-col shadow-xl">
            {sidebar}
          </aside>
        </div>
      )}
      <div className="lg:pl-64">
        <header className="bg-background/90 sticky top-0 z-30 flex h-16 items-center justify-between border-b px-4 backdrop-blur sm:px-7">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={toggleNavigation}
              aria-label="Open navigation"
            >
              <Menu />
            </Button>
            <div>
              <p className="text-sm font-bold">{config.label} workspace</p>
              <p className="text-muted-foreground hidden text-xs sm:block">
                Restaurant operations foundation
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              aria-label="Notifications"
              disabled
            >
              <Bell />
            </Button>
            <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-full text-xs font-bold">
              RF
            </span>
          </div>
        </header>
        <main className="p-4 sm:p-7 lg:p-9">{children}</main>
      </div>
    </div>
  );
}
