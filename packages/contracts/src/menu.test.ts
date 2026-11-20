import { describe, expect, it } from "vitest";

import {
  assignModifierGroupsRequestSchema,
  createMenuItemRequestSchema,
  createModifierGroupRequestSchema,
} from "./menu.js";

describe("menu contracts", () => {
  it("rejects negative base prices", () => {
    expect(
      createMenuItemRequestSchema.safeParse({
        categoryId: "9010e67f-4aa1-428e-bc26-6de08366aab2",
        name: "Soup",
        priceMinor: -1,
      }).success,
    ).toBe(false);
  });

  it("enforces valid selection limits", () => {
    expect(
      createModifierGroupRequestSchema.safeParse({
        name: "Spice",
        minSelections: 2,
        maxSelections: 1,
      }).success,
    ).toBe(false);
  });

  it("rejects duplicate modifier group assignments", () => {
    const id = "9010e67f-4aa1-428e-bc26-6de08366aab2";
    expect(
      assignModifierGroupsRequestSchema.safeParse({
        assignments: [
          { modifierGroupId: id, sortOrder: 0 },
          { modifierGroupId: id, sortOrder: 1 },
        ],
      }).success,
    ).toBe(false);
  });
});
