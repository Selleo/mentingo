import { Navigate, redirect } from "@remix-run/react";

import { currentUserQueryOptions, useCurrentUser } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { Dashboard } from "~/modules/Dashboard/Dashboard";
import { saveEntryToNavigationHistory } from "~/utils/saveEntryToNavigationHistory";

import { LOGIN_REDIRECT_URL } from "../Auth/constants";
import { useCurrentUserStore } from "../common/store/useCurrentUserStore";

import { useSyncUserAfterLogin } from "./hooks/useSyncUserAfterLogin";

export const clientLoader = async ({ request }: { request: Request }) => {
  try {
    const user = await queryClient.ensureQueryData(currentUserQueryOptions);

    if (!user) {
      saveEntryToNavigationHistory(request);

      throw redirect("/auth/login");
    }
  } catch (error) {
    throw redirect("/auth/login");
  }

  return null;
};

export default function UserDashboardLayout() {
  const { data: user } = useCurrentUser();
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);
  const getLastEntry = useNavigationHistoryStore((state) => state.getLastEntry);

  const lastEntry = getLastEntry();

  useSyncUserAfterLogin(user);

  if (!hasVerifiedMFA) {
    return <Navigate to="/auth/mfa" />;
  }

  if (lastEntry && lastEntry.pathname !== "/")
    return <Navigate to={lastEntry.pathname || LOGIN_REDIRECT_URL} />;

  const isAuthenticated = Boolean(user && hasVerifiedMFA);

  return <Dashboard isAuthenticated={isAuthenticated} />;
}
