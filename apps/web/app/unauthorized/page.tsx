"use client";

import { ShieldX } from "lucide-react";
import Link from "next/link";

import { homeForRole, useAuth } from "@/components/auth/auth-provider";
import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function UnauthorizedPage() {
  const { user, logout } = useAuth();
  const membership = user?.memberships[0];

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Logo />
          <span className="mt-6 grid size-12 place-items-center rounded-xl bg-amber-100 text-amber-800">
            <ShieldX aria-hidden="true" />
          </span>
          <CardTitle className="pt-3 text-2xl">Access not available</CardTitle>
          <p className="text-muted-foreground">
            Your staff account does not have permission to open that workspace.
          </p>
        </CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row">
          {membership && (
            <Button asChild>
              <Link href={homeForRole(membership.role)}>Open my workspace</Link>
            </Button>
          )}
          <Button variant="outline" onClick={() => void logout()}>
            Sign out
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
