import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface HistoryEntry {
  pathname: string;
  timestamp: number;
}

interface NavigationHistoryState {
  navigationHistory: HistoryEntry[];
  addLastUnauthorizedEntry: (entry: HistoryEntry) => HistoryEntry | null;
  clearHistory: () => void;
}

export const useNavigationHistoryStore = create<NavigationHistoryState>()(
  persist(
    (set) => ({
      navigationHistory: [],

      addLastUnauthorizedEntry: (entry) => {
        set({ navigationHistory: [entry] });

        return entry;
      },

      clearHistory: () => set({ navigationHistory: [] }),
    }),
    {
      name: "navigation-history",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
