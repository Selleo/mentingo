import { Navigate, useNavigate } from "@remix-run/react";
import { useEffect } from "react";

import { useCurrentUserSuspense } from "~/api/queries";
import { useUserSettings } from "~/api/queries/useUserSettings";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";

import Loader from "../common/Loader/Loader";
import { useCurrentUserStore } from "../common/store/useCurrentUserStore";

import { SetupMFACard, VerifyMFACard } from "./components";
import { resolvePostAuthRedirectPath } from "./utils/resolvePostAuthRedirectPath";

export default function MFAPage() {
  const navigate = useNavigate();
  const { data: userSettings, isLoading, isFetching } = useUserSettings();
  const { data: currentUser } = useCurrentUserSuspense();
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);
  const lastEntry = useNavigationHistoryStore((state) => state.navigationHistory[0] ?? null);

  const redirectPath = resolvePostAuthRedirectPath({ pathname: lastEntry?.pathname });

  useEffect(() => {
    if (!hasVerifiedMFA) return;

    navigate(redirectPath, { replace: true });
  }, [hasVerifiedMFA, navigate, redirectPath]);

  if (!currentUser) {
    return <Navigate to="/auth/login" />;
  }

  if (hasVerifiedMFA) {
    return null;
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
