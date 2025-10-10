import { create } from "zustand";
import { persist } from "zustand/middleware";

interface INavigationStore {
  expandedMenus: string[];
  setExpandedMenus: (menus: string[]) => void;
}

export const useNavigationStore = create<INavigationStore>()(
  persist(
    (set) => ({
      expandedMenus: [],
      setExpandedMenus: (menus) => set({ expandedMenus: menus }),
    }),
    {
      name: "navigation-storage",
      partialize: (state) => ({
        expandedMenus: state.expandedMenus,
      }),
    },
  ),
);
