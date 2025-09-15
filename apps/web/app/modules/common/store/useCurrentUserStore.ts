import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { CurrentUserResponse } from "~/api/generated-api";

type CurrentUserStore = {
  currentUser: CurrentUserResponse["data"] | undefined;
  setCurrentUser: (value: CurrentUserStore["currentUser"]) => void;
  hasVerifiedMFA: boolean;
  setHasVerifiedMFA: (value: boolean) => void;
};

export const useCurrentUserStore = create<CurrentUserStore>()(
  persist(
    (set) => ({
      currentUser: undefined,
      setCurrentUser: (value) => set({ currentUser: value }),
      hasVerifiedMFA: false,
      setHasVerifiedMFA: (value) => set({ hasVerifiedMFA: value }),
    }),
    {
      name: "current-user-storage",
    },
  ),
);
