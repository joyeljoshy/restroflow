export function formatMinorCurrency(
  amountMinor: number,
  currency = "INR",
  locale = "en-IN",
) {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(amountMinor / 100);
}

export function majorAmountToMinor(value: string): number | null {
  const normalized = value.trim();
  if (!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const minor = BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0"));
  if (minor <= 0n || minor > 2_147_483_647n) return null;
  return Number(minor);
}
