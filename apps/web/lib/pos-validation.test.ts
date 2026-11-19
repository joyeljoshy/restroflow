import { describe, expect, it } from "vitest";

import { createModifierFormSchema } from "./pos-validation";

const first = "10000000-0000-4000-8000-000000000001";
const second = "10000000-0000-4000-8000-000000000002";
const schema = createModifierFormSchema([
  {
    name: "Protein",
    minSelections: 1,
    maxSelections: 1,
    modifiers: [{ id: first }, { id: second }],
  },
]);

describe("POS modifier validation", () => {
  it("accepts selections within the group limits", () => {
    expect(
      schema.safeParse({
        modifierIds: [first],
        quantity: 2,
        instructions: "No onion",
      }).success,
    ).toBe(true);
  });

  it("rejects missing and excessive modifier selections", () => {
    expect(
      schema.safeParse({ modifierIds: [], quantity: 1, instructions: "" })
        .success,
    ).toBe(false);
    expect(
      schema.safeParse({
        modifierIds: [first, second],
        quantity: 1,
        instructions: "",
      }).success,
    ).toBe(false);
  });

  it("bounds quantity and special instructions", () => {
    expect(
      schema.safeParse({
        modifierIds: [first],
        quantity: 0,
        instructions: "",
      }).success,
    ).toBe(false);
    expect(
      schema.safeParse({
        modifierIds: [first],
        quantity: 1,
        instructions: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});
