import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export interface HistoryEntry {
  pathname: string;
  timestamp: number;
}

interface NavigationHistoryState {
  navigationHistory: HistoryEntry[];
  addLastUnauthorizedEntry: (entry: HistoryEntry) => HistoryEntry | null;
  mergeNavigationHistory: () => void;
  clearHistory: () => void;
  getLastEntry: () => HistoryEntry | null;
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

      mergeNavigationHistory: () => {
        const sessionStorageHistory = sessionStorage.getItem("navigation-history");

        if (sessionStorageHistory) {
          const parsedHistory: HistoryEntry =
            JSON.parse(sessionStorageHistory).state.navigationHistory[0];

          set({ navigationHistory: [parsedHistory] });
        }
      },

      getLastEntry: () => {
        const { navigationHistory } = get();
        return navigationHistory.length > 0 ? navigationHistory[0] : null;
      },
    }),
    {
      name: "navigation-history",
      storage: createJSONStorage(() => sessionStorage),
    },
  ),
);
