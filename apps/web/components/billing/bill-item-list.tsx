import type { BillItem, BillPreviewItem } from "@restroflow/contracts";

import { formatMinorCurrency } from "@/lib/currency";

export function BillItemList({
  items,
  currency,
}: {
  items: (BillItem | BillPreviewItem)[];
  currency: string;
}) {
  return (
    <ol className="divide-y" aria-label="Bill items">
      {items.map((item) => (
        <li
          key={item.sourceOrderItemId}
          className="grid gap-2 py-4 sm:grid-cols-[1fr_auto]"
        >
          <div>
            <p className="font-semibold">
              {item.quantity} × {item.itemNameSnapshot}
            </p>
            <p className="text-muted-foreground mt-1 text-xs">
              {item.orderNumberSnapshot} · Batch {item.batchNumber}
            </p>
            {item.modifiers.length > 0 && (
              <ul className="text-muted-foreground mt-2 space-y-1 text-sm">
                {item.modifiers.map((modifier) => (
                  <li key={modifier.id}>
                    + {modifier.modifierNameSnapshot}
                    {modifier.quantity > 1
                      ? ` × ${modifier.quantity}`
                      : ""} ·{" "}
                    {formatMinorCurrency(
                      modifier.modifierPriceMinor * modifier.quantity,
                      currency,
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <p className="font-semibold tabular-nums">
            {formatMinorCurrency(item.finalLineAmountMinor, currency)}
          </p>
        </li>
      ))}
    </ol>
  );
}
