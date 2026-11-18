import { Utensils } from "lucide-react";

import { cn } from "@/lib/utils";

export function Logo({
  compact = false,
  className,
}: {
  compact?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2.5 font-bold tracking-tight",
        className,
      )}
    >
      <span className="bg-primary text-primary-foreground grid size-9 place-items-center rounded-xl shadow-sm">
        <Utensils className="size-4" aria-hidden="true" />
      </span>
      {!compact && <span className="text-lg">RestroFlow</span>}
    </span>
  );
}
