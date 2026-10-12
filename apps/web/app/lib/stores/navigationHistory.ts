import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface HistoryEntry {
  pathname: string;
  timestamp: number;
}

interface NavigationHistoryState {
  navigationHistory: HistoryEntry[];
  addLastUnauthorizedEntry: (entry: HistoryEntry) => HistoryEntry | null;
  consumeLastUnauthorizedEntry: () => HistoryEntry | null;
  clearHistory: () => void;
}

export const useNavigationHistoryStore = create<NavigationHistoryState>()(
  persist(
    (set, get) => ({
      navigationHistory: [],

      addLastUnauthorizedEntry: (entry) => {
        set({ navigationHistory: [entry] });

        return entry;
      },

      clearHistory: () => set({ navigationHistory: [] }),

      consumeLastUnauthorizedEntry: () => {
        const entry = get().navigationHistory[0] ?? null;
        if (entry) set({ navigationHistory: [] });
        return entry;
      },
    }),
    {
      name: "navigation-history",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
