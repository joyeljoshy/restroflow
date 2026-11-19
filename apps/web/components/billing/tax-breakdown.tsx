import { formatMinorCurrency } from "@/lib/currency";

export function TaxBreakdown({
  subtotalMinor,
  taxMinor,
  totalMinor,
  taxName,
  taxRateBasisPoints,
  pricesIncludeTax,
  currency,
}: {
  subtotalMinor: number;
  taxMinor: number;
  totalMinor: number;
  taxName: string;
  taxRateBasisPoints: number;
  pricesIncludeTax: boolean;
  currency: string;
}) {
  return (
    <dl className="space-y-2 border-t pt-4 text-sm">
      <div className="flex justify-between gap-4">
        <dt>{pricesIncludeTax ? "Item total (tax inclusive)" : "Subtotal"}</dt>
        <dd className="tabular-nums">
          {formatMinorCurrency(subtotalMinor, currency)}
        </dd>
      </div>
      <div className="text-muted-foreground flex justify-between gap-4">
        <dt>
          {taxName} ({(taxRateBasisPoints / 100).toFixed(2)}%)
          {pricesIncludeTax ? " included" : ""}
        </dt>
        <dd className="tabular-nums">
          {formatMinorCurrency(taxMinor, currency)}
        </dd>
      </div>
      <div className="flex justify-between gap-4 border-t pt-3 text-base font-bold">
        <dt>Total</dt>
        <dd className="tabular-nums">
          {formatMinorCurrency(totalMinor, currency)}
        </dd>
      </div>
    </dl>
  );
}
