import { describe, expect, it } from "vitest";

import { formatMinorCurrency, majorAmountToMinor } from "./currency";

describe("currency utilities", () => {
  it("formats integer minor units without changing their value", () => {
    expect(formatMinorCurrency(28_350, "INR")).toContain("283.50");
  });

  it("parses at most two decimal places into integer minor units", () => {
    expect(majorAmountToMinor("400")).toBe(40_000);
    expect(majorAmountToMinor("600.50")).toBe(60_050);
    expect(majorAmountToMinor("1.234")).toBeNull();
    expect(majorAmountToMinor("0")).toBeNull();
  });
});
