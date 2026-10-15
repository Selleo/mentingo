import { Outlet } from "@remix-run/react";
import { useEffect } from "react";

import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { MFAGuard } from "~/Guards/MFAGuard";
import { useSyncUserAfterLogin } from "~/modules/Dashboard/hooks/useSyncUserAfterLogin";

import { useCurrentUserStore } from "../common/store/useCurrentUserStore";

export default function AuthLayout() {
  const { data: user } = useCurrentUserSessionSuspense();
  useSyncUserAfterLogin(user);
  const setHasVerifiedMFA = useCurrentUserStore((state) => state.setHasVerifiedMFA);

  useEffect(() => {
    setHasVerifiedMFA(false);
  }, [setHasVerifiedMFA]);

  return (
    <main className="flex min-h-screen w-screen items-center justify-center">
      <MFAGuard mode="auth">
        <Outlet />
      </MFAGuard>
    </main>
  );
}
