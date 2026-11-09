import { useEffect } from "react";

import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type { CurrentUserResponse } from "~/api/generated-api";

export const useSyncUserAfterLogin = (user?: CurrentUserResponse["data"] | null) => {
  useEffect(() => {
    // The query result owns synchronization. Target-store writes must not
    // retrigger this effect and make mounted synchronizers rewrite each other.
    const { isLoggedIn, setLoggedIn } = useAuthStore.getState();
    const { currentUser, setCurrentUser } = useCurrentUserStore.getState();
    if (user === null) {
      if (currentUser) setCurrentUser(undefined);
      if (isLoggedIn) setLoggedIn(false);
      return;
    }
    if (!user) return;

    if (!isLoggedIn) {
      setLoggedIn(true);
    }

    if (currentUser !== user) {
      setCurrentUser(user);
    }
  }, [user]);
};
