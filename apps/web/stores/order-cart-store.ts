import { create } from "zustand";

export type CartModifier = {
  id: string;
  groupId: string;
  groupName: string;
  name: string;
  priceDeltaMinor: number;
};

export type CartLine = {
  key: string;
  menuItemId: string;
  name: string;
  imageUrl: string | null;
  unitPriceMinor: number;
  quantity: number;
  modifiers: CartModifier[];
  specialInstructions: string | null;
};

export type NewCartLine = Omit<CartLine, "key">;

export function cartLineKey(line: {
  menuItemId: string;
  modifiers: Pick<CartModifier, "id">[];
  specialInstructions: string | null;
}) {
  const modifierKey = line.modifiers
    .map((modifier) => modifier.id)
    .sort()
    .join(",");
  return `${line.menuItemId}|${modifierKey}|${line.specialInstructions?.trim() ?? ""}`;
}

export function cartLineTotal(line: CartLine) {
  const modifierTotal = line.modifiers.reduce(
    (total, modifier) => total + modifier.priceDeltaMinor,
    0,
  );
  return (line.unitPriceMinor + modifierTotal) * line.quantity;
}

export function cartEstimatedTotal(lines: CartLine[]) {
  return lines.reduce((total, line) => total + cartLineTotal(line), 0);
}

type OrderCartState = {
  lines: CartLine[];
  addLine: (line: NewCartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
};

export const useOrderCartStore = create<OrderCartState>((set) => ({
  lines: [],
  addLine: (line) =>
    set((state) => {
      const key = cartLineKey(line);
      const existing = state.lines.find((candidate) => candidate.key === key);
      return {
        lines: existing
          ? state.lines.map((candidate) =>
              candidate.key === key
                ? { ...candidate, quantity: candidate.quantity + line.quantity }
                : candidate,
            )
          : [...state.lines, { ...line, key }],
      };
    }),
  setQuantity: (key, quantity) =>
    set((state) => ({
      lines:
        quantity <= 0
          ? state.lines.filter((line) => line.key !== key)
          : state.lines.map((line) =>
              line.key === key ? { ...line, quantity } : line,
            ),
    })),
  removeLine: (key) =>
    set((state) => ({
      lines: state.lines.filter((line) => line.key !== key),
    })),
  clear: () => set({ lines: [] }),
}));
