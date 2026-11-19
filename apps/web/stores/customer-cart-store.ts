import { create } from "zustand";

import type { CartLine, NewCartLine } from "./order-cart-store";
import { cartLineKey } from "./order-cart-store";

type CustomerCartState = {
  scope: string | null;
  lines: CartLine[];
  ensureScope: (scope: string) => void;
  addLine: (line: NewCartLine) => void;
  setQuantity: (key: string, quantity: number) => void;
  removeLine: (key: string) => void;
  clear: () => void;
};

export const useCustomerCartStore = create<CustomerCartState>((set) => ({
  scope: null,
  lines: [],
  ensureScope: (scope) =>
    set((state) => (state.scope === scope ? state : { scope, lines: [] })),
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
    set((state) => ({ lines: state.lines.filter((line) => line.key !== key) })),
  clear: () => set({ lines: [] }),
}));
