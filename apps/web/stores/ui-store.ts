import { create } from "zustand";

type UiState = {
  navigationOpen: boolean;
  closeNavigation: () => void;
  toggleNavigation: () => void;
};

export const useUiStore = create<UiState>((set) => ({
  navigationOpen: false,
  closeNavigation: () => set({ navigationOpen: false }),
  toggleNavigation: () =>
    set((state) => ({ navigationOpen: !state.navigationOpen })),
}));
