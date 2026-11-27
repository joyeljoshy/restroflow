import {
  ArrowRight,
  BarChart3,
  ChefHat,
  CircleCheck,
  Clock3,
  Radio,
  ReceiptText,
  ShieldCheck,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { YouTubeDemo } from "@/components/marketing/youtube-demo";
import { SystemStatus } from "@/components/system-status";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

const capabilities = [
  {
    icon: ReceiptText,
    title: "Orders stay coherent",
    copy: "One authoritative flow from table-side entry through kitchen preparation and billing.",
  },
  {
    icon: Radio,
    title: "Changes arrive in real time",
    copy: "Operational screens stay synchronized while REST remains the reliable source of truth.",
  },
  {
    icon: BarChart3,
    title: "Leaders see the shift",
    copy: "A clear foundation for service health, sales patterns, and restaurant performance.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen overflow-hidden">
      <header className="mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link
          href="/"
          aria-label="RestroFlow home"
          className="focus-visible:ring-ring rounded-xl focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
        >
          <Logo />
        </Link>
        <nav
          className="flex items-center gap-2"
          aria-label="Primary navigation"
        >
          <Button asChild variant="ghost" className="hidden sm:inline-flex">
            <Link href="#platform">Platform</Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/login">Staff sign in</Link>
          </Button>
        </nav>
      </header>

      <section className="relative mx-auto grid max-w-7xl gap-14 px-5 pt-16 pb-24 sm:px-8 lg:grid-cols-[1.02fr_.98fr] lg:items-center lg:pt-24 lg:pb-32">
        <div className="absolute top-0 -left-40 -z-10 size-[34rem] rounded-full bg-emerald-200/25 blur-3xl" />
        <div>
          <div className="border-primary/20 bg-card text-primary mb-6 inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold tracking-[0.16em] uppercase">
            <span className="size-1.5 rounded-full bg-current" /> Restaurant
            operations, in flow
          </div>
          <h1 className="max-w-2xl text-5xl leading-[1.02] font-bold tracking-[-0.045em] sm:text-6xl lg:text-7xl">
            One calm command center for every busy service.
          </h1>
          <p className="text-muted-foreground mt-7 max-w-xl text-lg leading-8">
            RestroFlow brings the dining room, kitchen, counter, and management
            team into one dependable operating rhythm.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/login">
                Open staff workspace <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="#platform">Explore the foundation</Link>
            </Button>
          </div>
          <div className="mt-7">
            <SystemStatus />
          </div>
        </div>

        <div className="relative lg:pl-6">
          <div className="bg-card overflow-hidden rounded-2xl border shadow-[0_25px_80px_-32px_rgba(20,55,40,.35)]">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <div>
                <p className="text-sm font-bold">Evening service</p>
                <p className="text-muted-foreground text-xs">
                  Operations overview · illustrative
                </p>
              </div>
              <span className="bg-accent text-accent-foreground rounded-full px-2.5 py-1 text-xs font-semibold">
                Live foundation
              </span>
            </div>
            <div className="grid gap-3 p-4 sm:grid-cols-3">
              {[
                ["Open tables", "12", "4 seated now"],
                ["Kitchen queue", "08", "6 min average"],
                ["Shift sales", "₹—", "Available in analytics"],
              ].map(([label, value, note]) => (
                <div key={label} className="bg-muted/60 rounded-xl p-4">
                  <p className="text-muted-foreground text-xs font-medium">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-bold">{value}</p>
                  <p className="text-muted-foreground mt-1 text-[11px]">
                    {note}
                  </p>
                </div>
              ))}
            </div>
            <div className="px-4 pb-4">
              <div className="rounded-xl border p-4">
                <div className="mb-4 flex items-center justify-between">
                  <p className="text-sm font-bold">Kitchen progress</p>
                  <ChefHat className="text-primary size-4" aria-hidden="true" />
                </div>
                <div className="space-y-3">
                  {[
                    ["Table 08", "Preparing", "6 items", "65%"],
                    ["Table 03", "Ready", "3 items", "100%"],
                    ["Takeaway 21", "New", "2 items", "18%"],
                  ].map(([table, status, items, width]) => (
                    <div
                      key={table}
                      className="grid grid-cols-[1fr_auto] gap-x-4 gap-y-2 text-xs"
                    >
                      <span className="font-semibold">{table}</span>
                      <span className="text-muted-foreground">
                        {status} · {items}
                      </span>
                      <span className="bg-muted col-span-2 h-1.5 overflow-hidden rounded-full">
                        <span
                          className="bg-primary block h-full rounded-full"
                          style={{ width }}
                        />
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className="bg-card absolute -bottom-7 -left-3 hidden items-center gap-3 rounded-xl border p-3 shadow-lg sm:flex">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-100 text-emerald-700">
              <CircleCheck className="size-5" />
            </span>
            <div>
              <p className="text-xs font-bold">Shared source of truth</p>
              <p className="text-muted-foreground text-[11px]">
                Recoverable after reconnect
              </p>
            </div>
          </div>
        </div>
      </section>

      <section id="platform" className="border-y bg-stone-950 text-stone-50">
        <div className="mx-auto max-w-7xl px-5 py-20 sm:px-8 lg:py-24">
          <div className="grid gap-6 lg:grid-cols-[.8fr_1.2fr] lg:gap-20">
            <div>
              <p className="text-sm font-bold tracking-[0.16em] text-emerald-400 uppercase">
                Built for the whole shift
              </p>
              <h2 className="mt-4 text-3xl font-bold tracking-tight sm:text-4xl">
                Less chasing. More service.
              </h2>
            </div>
            <p className="text-lg leading-8 text-stone-400">
              The foundation establishes a maintainable interface,
              production-minded architecture, and secure role-based staff
              access. Operational workflows will be added incrementally.
            </p>
          </div>
          <div className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 md:grid-cols-3">
            {capabilities.map(({ icon: Icon, title, copy }) => (
              <article key={title} className="bg-stone-950 p-7">
                <Icon className="size-5 text-emerald-400" />
                <h3 className="mt-6 font-bold">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-stone-400">{copy}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <YouTubeDemo />

      <section className="mx-auto max-w-7xl px-5 py-20 sm:px-8">
        <div className="bg-card grid gap-6 rounded-2xl border p-7 sm:p-10 lg:grid-cols-[1fr_auto] lg:items-center">
          <div>
            <div className="text-primary flex gap-2">
              <ShieldCheck />
              <Clock3 />
            </div>
            <h2 className="mt-5 text-3xl font-bold tracking-tight">
              A strong foundation before the first order.
            </h2>
            <p className="text-muted-foreground mt-3 max-w-2xl leading-7">
              Typed contracts, database readiness, secure staff sessions,
              structured errors, accessible UI primitives, and test foundations
              are in place—without pretending unfinished business features are
              ready.
            </p>
          </div>
          <Button asChild size="lg">
            <Link href="/login">
              View role workspaces <ArrowRight />
            </Link>
          </Button>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-5 py-8 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <Logo />
          <p className="text-muted-foreground">
            Parts 1–3 · Foundation, staff access, and restaurant management
          </p>
        </div>
      </footer>
    </main>
  );
}
