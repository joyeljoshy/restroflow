import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center p-6">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <Logo />
          <p className="text-primary mt-6 text-sm font-bold tracking-[0.16em] uppercase">
            Error 404
          </p>
          <CardTitle className="pt-2 text-3xl">
            This page is off the menu.
          </CardTitle>
          <p className="text-muted-foreground leading-7">
            The address may be incorrect, or the page may have moved.
          </p>
        </CardHeader>
        <CardContent>
          <Button asChild>
            <Link href="/">Return to RestroFlow</Link>
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
