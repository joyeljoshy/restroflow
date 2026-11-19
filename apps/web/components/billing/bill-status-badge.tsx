import type { BillStatus } from "@restroflow/contracts";

import { cn } from "@/lib/utils";

const labels: Record<BillStatus | "UNBILLED", string> = {
  UNBILLED: "Not finalized",
  FINALIZED: "Payment due",
  PARTIALLY_PAID: "Partially paid",
  PAID: "Paid",
};

export function BillStatusBadge({
  status,
}: {
  status: BillStatus | "UNBILLED";
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-1 text-xs font-bold",
        status === "PAID"
          ? "bg-emerald-100 text-emerald-800"
          : status === "PARTIALLY_PAID"
            ? "bg-amber-100 text-amber-900"
            : status === "FINALIZED"
              ? "bg-orange-100 text-orange-900"
              : "bg-stone-100 text-stone-700",
      )}
    >
      {labels[status]}
    </span>
  );
}
