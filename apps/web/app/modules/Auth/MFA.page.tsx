import { Navigate } from "@remix-run/react";
import { useEffect, useMemo } from "react";

import { useCurrentUserSuspense } from "~/api/queries";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";

import Loader from "../common/Loader/Loader";
import { useCurrentUserStore } from "../common/store/useCurrentUserStore";

import { SetupMFACard, VerifyMFACard } from "./components";
import { resolvePostAuthRedirectPath } from "./utils/resolvePostAuthRedirectPath";

export default function MFAPage() {
  const { data: userSettings, isLoading, isFetching } = useUserSettings();
  const { data: currentUser } = useCurrentUserSuspense();
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);
  const getLastEntry = useNavigationHistoryStore((state) => state.getLastEntry);
  const mergeNavigationHistory = useNavigationHistoryStore((state) => state.mergeNavigationHistory);
  const clearHistory = useNavigationHistoryStore((state) => state.clearHistory);

  const redirectPath = useMemo(() => {
    mergeNavigationHistory();

    return resolvePostAuthRedirectPath({ pathname: getLastEntry()?.pathname });
  }, [getLastEntry, mergeNavigationHistory]);

  useEffect(() => {
    if (!hasVerifiedMFA) return;

    clearHistory();
  }, [clearHistory, hasVerifiedMFA]);

  if (!currentUser) {
    return <Navigate to="/auth/login" />;
  }

  if (hasVerifiedMFA) {
    return <Navigate to={redirectPath} />;
  }

  if (isLoading || isFetching || !userSettings) {
    return (
      <div className="grid h-full w-full place-items-center">
        <Loader />
      </div>
    );
  }

  if (!userSettings.isMFAEnabled) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center px-6">
        <SetupMFACard />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      <VerifyMFACard />
    </div>
  );
}
