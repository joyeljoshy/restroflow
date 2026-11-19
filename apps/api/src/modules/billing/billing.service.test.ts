import { describe, expect, it } from "vitest";

import { BILL_ROUNDING_POLICY, calculateLineTax } from "./billing.service";

describe("billing money policy", () => {
  it("rounds exclusive tax half-up per line using basis points", () => {
    expect(calculateLineTax(27_000, 500, false)).toBe(1_350);
    expect(calculateLineTax(10, 500, false)).toBe(1);
    expect(calculateLineTax(9, 500, false)).toBe(0);
    expect(BILL_ROUNDING_POLICY).toBe("PER_LINE_HALF_UP_V1");
  });

  it("extracts included tax without increasing the payable line", () => {
    expect(calculateLineTax(10_500, 500, true)).toBe(500);
    expect(calculateLineTax(0, 500, true)).toBe(0);
    expect(calculateLineTax(10_000, 0, false)).toBe(0);
  });
});
