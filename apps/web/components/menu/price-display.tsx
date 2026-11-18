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
      {new Intl.NumberFormat(locale, {
        style: "currency",
        currency,
        minimumFractionDigits: 2,
      }).format(amountMinor / 100)}
    </span>
  );
}
