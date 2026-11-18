import { ArrowLeft, LockKeyhole } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { LoginForm } from "@/components/auth/login-form";
import { Logo } from "@/components/brand/logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = { title: "Staff sign in" };

export default function LoginPage() {
  return (
    <main className="grid min-h-screen lg:grid-cols-[.85fr_1.15fr]">
      <section className="flex flex-col p-6 sm:p-10">
        <Link href="/">
          <Logo />
        </Link>
        <div className="mx-auto flex w-full max-w-md flex-1 items-center py-12">
          <Card className="w-full border-0 shadow-none sm:border sm:shadow-sm">
            <CardHeader className="px-0 sm:px-6">
              <span className="bg-accent text-accent-foreground mb-3 grid size-10 place-items-center rounded-lg">
                <LockKeyhole className="size-5" />
              </span>
              <CardTitle className="text-3xl">Welcome back</CardTitle>
              <p className="text-muted-foreground">
                Use your staff account to enter the operations workspace.
              </p>
            </CardHeader>
            <CardContent className="px-0 sm:px-6">
              <LoginForm />
              <Link
                href="/"
                className="text-muted-foreground hover:text-foreground mt-6 inline-flex items-center gap-2 text-sm"
              >
                <ArrowLeft className="size-4" /> Back to overview
              </Link>
            </CardContent>
          </Card>
        </div>
      </section>
      <aside className="relative hidden overflow-hidden bg-stone-950 p-12 text-stone-100 lg:flex lg:flex-col lg:justify-end">
        <div className="absolute top-[-5%] right-[-10%] size-[32rem] rounded-full bg-emerald-600/20 blur-3xl" />
        <div className="relative max-w-lg">
          <p className="text-sm font-bold tracking-[.18em] text-emerald-400 uppercase">
            Workspace preview
          </p>
          <h2 className="mt-5 text-4xl leading-tight font-bold tracking-tight">
            The right view for every role on the floor.
          </h2>
          <p className="mt-5 leading-7 text-stone-400">
            Admin, kitchen, and waiter shells are ready for the secure workflows
            introduced in later parts.
          </p>
          <div className="mt-8 flex gap-2">
            {["Admin", "Kitchen", "Waiter"].map((role) => (
              <span
                key={role}
                className="rounded-full border border-white/15 px-3 py-1.5 text-xs font-semibold"
              >
                {role}
              </span>
            ))}
          </div>
        </div>
      </aside>
    </main>
  );
}
