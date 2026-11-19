import type { RestaurantTable } from "@restroflow/contracts";

import { cn } from "@/lib/utils";

const labels: Record<RestaurantTable["occupancy"], string> = {
  AVAILABLE: "Available",
  OCCUPIED: "Occupied",
  OUT_OF_SERVICE: "Out of service",
};

export function TableStatusBadge({
  occupancy,
}: {
  occupancy: RestaurantTable["occupancy"];
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
        occupancy === "AVAILABLE" && "bg-emerald-100 text-emerald-800",
        occupancy === "OCCUPIED" && "bg-amber-100 text-amber-900",
        occupancy === "OUT_OF_SERVICE" && "bg-stone-200 text-stone-700",
      )}
    >
      {labels[occupancy]}
    </span>
  );
}
