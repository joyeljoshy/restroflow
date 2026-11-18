import { ArrowUpRight, CircleDashed, Clock3 } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function WorkspacePlaceholder({
  eyebrow,
  title,
  description,
  metrics,
}: {
  eyebrow: string;
  title: string;
  description: string;
  metrics: { label: string; value: string; note: string }[];
}) {
  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-primary text-xs font-bold tracking-[.16em] uppercase">
            {eyebrow}
          </p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight">{title}</h1>
          <p className="text-muted-foreground mt-2 max-w-2xl">{description}</p>
        </div>
        <span className="bg-card text-muted-foreground inline-flex w-fit items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold">
          <Clock3 className="size-3.5" /> Placeholder workspace
        </span>
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {metrics.map((metric) => (
          <Card key={metric.label}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <p className="text-muted-foreground text-sm font-medium">
                  {metric.label}
                </p>
                <ArrowUpRight className="text-muted-foreground size-4" />
              </div>
              <CardTitle className="text-3xl">{metric.value}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground text-xs">{metric.note}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="mt-6 border-dashed">
        <CardContent className="flex min-h-72 flex-col items-center justify-center p-8 text-center">
          <span className="bg-muted grid size-12 place-items-center rounded-full">
            <CircleDashed className="text-muted-foreground" />
          </span>
          <h2 className="mt-5 text-lg font-bold">
            Ready for the next implementation part
          </h2>
          <p className="text-muted-foreground mt-2 max-w-lg text-sm leading-6">
            This route proves the responsive workspace shell and navigation. No
            operational data or actions are simulated as completed
            functionality.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
