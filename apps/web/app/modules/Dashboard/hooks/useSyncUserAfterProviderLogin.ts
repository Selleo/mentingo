import { useAuthStore } from "~/modules/Auth/authStore";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

import type { CurrentUserResponse } from "~/api/generated-api";

export const useSyncUserAfterProviderLogin = (user?: CurrentUserResponse["data"]) => {
  const setLoggedIn = useAuthStore((state) => state.setLoggedIn);
  const setCurrentUser = useCurrentUserStore(({ setCurrentUser }) => setCurrentUser);

  if (user) {
    setLoggedIn(true);
    setCurrentUser(user);
  }
};
