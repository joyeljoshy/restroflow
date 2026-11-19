import type { RestaurantTable } from "@restroflow/contracts";
import { Armchair, Clock3, Users } from "lucide-react";
import type { ReactNode } from "react";

import { Card } from "@/components/ui/card";

import { TableStatusBadge } from "./table-status-badge";

export function TableCard({
  table,
  actions,
}: {
  table: RestaurantTable;
  actions?: ReactNode;
}) {
  return (
    <Card className="flex min-h-64 flex-col overflow-hidden" role="article">
      <div className="flex items-start justify-between gap-3 p-5">
        <span className="bg-accent text-accent-foreground grid size-11 place-items-center rounded-xl">
          <Armchair className="size-5" aria-hidden="true" />
        </span>
        <TableStatusBadge occupancy={table.occupancy} />
      </div>
      <div className="flex-1 px-5 pb-5">
        <p className="text-muted-foreground text-xs font-bold tracking-wider uppercase">
          Table {table.tableNumber}
        </p>
        <h2 className="mt-1 text-xl font-bold">{table.displayName}</h2>
        <p className="text-muted-foreground mt-3 inline-flex items-center gap-2 text-sm">
          <Users className="size-4" aria-hidden="true" /> Seats {table.capacity}
        </p>
        {table.activeSession && (
          <p className="text-muted-foreground mt-2 flex items-center gap-2 text-xs">
            <Clock3 className="size-3.5" aria-hidden="true" /> Opened by{" "}
            {table.activeSession.openedBy.displayName} at{" "}
            {new Date(table.activeSession.openedAt).toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex flex-wrap gap-2 border-t p-4">{actions}</div>
      )}
    </Card>
  );
}
