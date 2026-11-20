export function formatMinorCurrency(
  amountMinor: number | string | bigint,
  currency = "INR",
  locale = "en-IN",
) {
  const minor = BigInt(amountMinor);
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const whole = minor / 100n;
  const fraction = (minor % 100n).toString().padStart(2, "0");
  const groupedWhole = new Intl.NumberFormat(locale, {
    maximumFractionDigits: 0,
  }).format(whole);
  return formatter
    .formatToParts(0)
    .map((part) => {
      if (part.type === "integer") return groupedWhole;
      if (part.type === "fraction") return fraction;
      return part.value;
    })
    .join("");
}

export function majorAmountToMinor(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (minor <= 0n || minor > 2_147_483_647n) return null;
  return Number(minor);
}
