import { formatMinorCurrency } from "@/lib/currency";

export function PriceDisplay({
  amountMinor,
  currency = "INR",
  locale = "en-IN",
  className,
}: {
  amountMinor: number;
  currency?: string;
  locale?: string;
  className?: string;
}) {
  return (
    <span className={className}>
      {formatMinorCurrency(amountMinor, currency, locale)}
    </span>
  );
}
