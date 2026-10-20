import { currentUserQueryOptions } from "~/api/queries/useCurrentUser";
import { getDashboardSettingsQueryKey } from "~/api/queries/useDashboardSettings";

import { userSettingsQueryOptions } from "../../queries/useUserSettings";
import { queryClient } from "../../queryClient";
import { mfaSetupQueryOptions } from "../useSetupMFA";

import type { CurrentUserResponse } from "../../generated-api";

type AuthSuccessUser = Omit<
  CurrentUserResponse["data"],
  "isSupportMode" | "studentModeCourseIds" | "permissions" | "roleSlugs"
> &
  Partial<
    Pick<
      CurrentUserResponse["data"],
      "isSupportMode" | "studentModeCourseIds" | "permissions" | "roleSlugs"
    >
  >;

type HandleAuthSuccessOptions = {
  user: AuthSuccessUser;
  setLoggedIn: (value: boolean) => void;
  setCurrentUser: (value: CurrentUserResponse["data"]) => void;
  setHasVerifiedMFA: (value: boolean) => void;
};

const normalizeAuthSuccessUser = (user: AuthSuccessUser): CurrentUserResponse["data"] => ({
  ...user,
  isSupportMode: user.isSupportMode ?? false,
  studentModeCourseIds: user.studentModeCourseIds ?? [],
  permissions: user.permissions ?? [],
  roleSlugs: user.roleSlugs ?? [],
});

/**
 * Auth responses carry no permissions, so route guards would treat the user as having none
 * and redirect them to the fallback page. Fetch the full current user before marking the
 * session as logged in, and fall back to the auth payload only when that request fails.
 */
const fetchCurrentUserAfterAuth = async (fallbackUser: CurrentUserResponse["data"]) => {
  try {
    const response = await queryClient.fetchQuery({ ...currentUserQueryOptions, staleTime: 0 });

    return response?.data ?? fallbackUser;
  } catch {
    return fallbackUser;
  }
};

export async function handleAuthSuccess({
  user,
  setLoggedIn,
  setCurrentUser,
  setHasVerifiedMFA,
}: HandleAuthSuccessOptions) {
  const currentUser = await fetchCurrentUserAfterAuth(normalizeAuthSuccessUser(user));

  queryClient.setQueryData(currentUserQueryOptions.queryKey, { data: currentUser });
  setLoggedIn(true);
  setCurrentUser(currentUser);
  setHasVerifiedMFA(!currentUser.shouldVerifyMFA);

  await Promise.all([
    queryClient.invalidateQueries({ queryKey: getDashboardSettingsQueryKey(currentUser.id) }),
    queryClient.invalidateQueries({ queryKey: userSettingsQueryOptions.queryKey }),
    queryClient.invalidateQueries({ queryKey: mfaSetupQueryOptions.queryKey }),
  ]);
}
