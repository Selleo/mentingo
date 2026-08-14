import { useEffect } from "react";

import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type { CurrentUserResponse } from "~/api/generated-api";

export const useSyncUserAfterLogin = (user?: CurrentUserResponse["data"]) => {
  const isLoggedIn = useAuthStore((state) => state.isLoggedIn);
  const setLoggedIn = useAuthStore((state) => state.setLoggedIn);
  const currentUser = useCurrentUserStore((state) => state.currentUser);
  const setCurrentUser = useCurrentUserStore(({ setCurrentUser }) => setCurrentUser);
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);

  useEffect(() => {
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
  }, [
    currentUser,
    hasVerifiedMFA,
    isLoggedIn,
    setCurrentUser,
    setHasVerifiedMFA,
    setLoggedIn,
    user,
  ]);
};
