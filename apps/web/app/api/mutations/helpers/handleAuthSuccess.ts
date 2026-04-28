import { currentUserQueryOptions } from "~/api/queries/useCurrentUser";

import { userSettingsQueryOptions } from "../../queries/useUserSettings";
import { queryClient } from "../../queryClient";
import { mfaSetupQueryOptions } from "../useSetupMFA";

import type { CurrentUserResponse } from "../../generated-api";

type AuthSuccessUser = Omit<
  CurrentUserResponse["data"],
  "isSupportMode" | "studentModeCourseIds" | "permissions" | "roleSlugs" | "gamification"
> &
  Partial<
    Pick<
      CurrentUserResponse["data"],
      "isSupportMode" | "studentModeCourseIds" | "permissions" | "roleSlugs" | "gamification"
    >
  >;

type HandleAuthSuccessOptions = {
  user: AuthSuccessUser;
  setLoggedIn: (value: boolean) => void;
  setCurrentUser: (value: CurrentUserResponse["data"]) => void;
  setHasVerifiedMFA: (value: boolean) => void;
};

export function handleAuthSuccess({
  user,
  setLoggedIn,
  setCurrentUser,
  setHasVerifiedMFA,
}: HandleAuthSuccessOptions) {
  const normalizedUser: CurrentUserResponse["data"] = {
    ...user,
    isSupportMode: user.isSupportMode ?? false,
    studentModeCourseIds: user.studentModeCourseIds ?? [],
    gamification: user.gamification ?? { totalPoints: 0, lastPointAt: null },
    permissions: user.permissions ?? [],
    roleSlugs: user.roleSlugs ?? [],
  };

  queryClient.setQueryData(currentUserQueryOptions.queryKey, { data: normalizedUser });
  queryClient.invalidateQueries(currentUserQueryOptions);
  queryClient.invalidateQueries(userSettingsQueryOptions);
  queryClient.invalidateQueries(mfaSetupQueryOptions);

  setLoggedIn(true);
  setCurrentUser(normalizedUser);
  setHasVerifiedMFA(!normalizedUser.shouldVerifyMFA);
}
