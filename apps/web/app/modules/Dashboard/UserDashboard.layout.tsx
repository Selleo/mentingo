import { redirect, useLocation, useNavigate } from "@remix-run/react";
import { useEffect } from "react";

import { currentUserQueryOptions, useCurrentUser } from "~/api/queries/useCurrentUser";
import { queryClient } from "~/api/queryClient";
import { MFAGuard } from "~/Guards/MFAGuard";
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
  const location = useLocation();
  const navigate = useNavigate();

  const { data: user } = useCurrentUser();
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);
  const lastEntry = useNavigationHistoryStore((state) => state.navigationHistory[0] ?? null);

  useSyncUserAfterLogin(user);

  const shouldRedirect = Boolean(lastEntry && lastEntry.pathname !== location.pathname);

  useEffect(() => {
    if (!shouldRedirect || !lastEntry) return;

    navigate(lastEntry.pathname || LOGIN_REDIRECT_URL, { replace: true });
  }, [lastEntry, navigate, shouldRedirect]);

  if (shouldRedirect) {
    return null;
  }

  const isAuthenticated = Boolean(user && (!user.shouldVerifyMFA || hasVerifiedMFA));

  return (
    <MFAGuard mode="app">
      <Dashboard isAuthenticated={isAuthenticated} />
    </MFAGuard>
  );
}
