import { cn } from "@/lib/utils";

export function AvailabilityBadge({ available }: { available: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold",
        available
          ? "bg-emerald-100 text-emerald-800"
          : "bg-stone-100 text-stone-600",
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          available ? "bg-emerald-500" : "bg-stone-400",
        )}
      />
      {available ? "Available" : "Unavailable"}
    </span>
  );
}
