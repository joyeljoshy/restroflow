"use client";

import type { Role } from "@restroflow/contracts";
import { LoaderCircle } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";

import { Button } from "@/components/ui/button";

import { useAuth } from "./auth-provider";

export function ProtectedLayout({
  roles,
  children,
}: {
  roles: readonly Role[];
  children: ReactNode;
}) {
  const { user, isLoading, authError, retryAuth } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const authorized = user?.memberships.some((membership) =>
    roles.includes(membership.role),
  );

  useEffect(() => {
    if (isLoading || authError) return;
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    } else if (!authorized) {
      router.replace("/unauthorized");
    }
  }, [authError, authorized, isLoading, pathname, router, user]);

  if (authError && !user) {
    return (
      <main className="grid min-h-screen place-items-center p-6">
        <div className="max-w-md text-center" role="alert">
          <h1 className="text-xl font-bold">Session check unavailable</h1>
          <p className="text-muted-foreground mt-2 text-sm leading-6">
            {authError}
          </p>
          <Button className="mt-5" onClick={() => void retryAuth()}>
            Try again
          </Button>
        </div>
      </main>
    );
  }

  if (isLoading || !user || !authorized) {
    return (
      <main className="grid min-h-screen place-items-center" aria-live="polite">
        <span className="text-muted-foreground inline-flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          Checking staff access
        </span>
      </main>
    );
  }

  return children;
}
