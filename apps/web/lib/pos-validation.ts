import { z } from "zod";

type PosModifierGroup = {
  name: string;
  minSelections: number;
  maxSelections: number;
  modifiers: { id: string }[];
};

export const modifierFormBaseSchema = z.object({
  modifierIds: z.array(z.uuid()).max(50),
  quantity: z.number().int().min(1).max(99),
  instructions: z.string().trim().max(500),
});

export type ModifierFormValues = z.infer<typeof modifierFormBaseSchema>;

export function createModifierFormSchema(groups: PosModifierGroup[]) {
  return modifierFormBaseSchema.superRefine((value, context) => {
    for (const group of groups) {
      const count = group.modifiers.filter((modifier) =>
        value.modifierIds.includes(modifier.id),
      ).length;
      if (count < group.minSelections || count > group.maxSelections)
        context.addIssue({
          code: "custom",
          path: ["modifierIds"],
          message: `Select between ${group.minSelections} and ${group.maxSelections} options for ${group.name}.`,
        });
    }
  });
}
