import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type { CurrentUserResponse } from "~/api/generated-api";

export const useSyncUserAfterLogin = (user?: CurrentUserResponse["data"]) => {
  const setLoggedIn = useAuthStore((state) => state.setLoggedIn);
  const setCurrentUser = useCurrentUserStore(({ setCurrentUser }) => setCurrentUser);
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);

  if (!hasVerifiedMFA && user?.shouldVerifyMFA) setHasVerifiedMFA(false);
  if (hasVerifiedMFA || !user?.shouldVerifyMFA) setHasVerifiedMFA(true);

  setLoggedIn(true);
  setCurrentUser(user);
};
