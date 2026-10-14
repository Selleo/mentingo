import { useEffect } from "react";

import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type { CurrentUserResponse } from "~/api/generated-api";

export const useSyncUserAfterLogin = (user?: CurrentUserResponse["data"] | null) => {
  useEffect(() => {
    // The query result owns synchronization. Target-store writes must not
    // retrigger this effect and make mounted synchronizers rewrite each other.
    const { isLoggedIn, setLoggedIn } = useAuthStore.getState();
    const { currentUser, setCurrentUser, hasVerifiedMFA, setHasVerifiedMFA } =
      useCurrentUserStore.getState();
    if (user === null) {
      if (currentUser) setCurrentUser(undefined);
      if (isLoggedIn) setLoggedIn(false);
      if (hasVerifiedMFA) setHasVerifiedMFA(false);
      return;
    }
    if (!user) return;

    const nextHasVerifiedMFA = user.shouldVerifyMFA ? hasVerifiedMFA : true;

    if (hasVerifiedMFA !== nextHasVerifiedMFA) {
      setHasVerifiedMFA(nextHasVerifiedMFA);
    }

    if (!isLoggedIn) {
      setLoggedIn(true);
    }

    if (currentUser !== user) {
      setCurrentUser(user);
    }
  }, [user]);
};
