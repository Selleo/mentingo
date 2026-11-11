import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CurrentUserResponse } from "~/api/generated-api";

type CurrentUserStore = {
  currentUser: CurrentUserResponse["data"] | undefined;
  setCurrentUser: (value: CurrentUserStore["currentUser"]) => void;
};

export const useCurrentUserStore = create<CurrentUserStore>()(
  persist(
    (set) => ({
      currentUser: undefined,
      setCurrentUser: (value) => set({ currentUser: value }),
    }),
    {
      name: "current-user-storage",
      version: 1,
      migrate: () => ({ currentUser: undefined }),
      partialize: () => ({}),
    },
  ),
);
