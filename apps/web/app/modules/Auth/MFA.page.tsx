import { Navigate } from "@remix-run/react";

import { useUserSettings } from "~/api/queries/useUserSettings";

import Loader from "../common/Loader/Loader";
import { useCurrentUserStore } from "../common/store/useCurrentUserStore";

import { SetupMFACard, VerifyMFACard } from "./components";

export default function MFAPage() {
  const { data: userSettings, isLoading } = useUserSettings();
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);

  if (hasVerifiedMFA) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <div className="grid h-full w-full place-items-center">
        <Loader />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6">
      {userSettings?.isMFAEnabled ? <VerifyMFACard /> : <SetupMFACard />}
    </div>
  );
}
