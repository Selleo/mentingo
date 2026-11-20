import { Outlet } from "@remix-run/react";

import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { MFAGuard } from "~/Guards/MFAGuard";
import { useSyncUserAfterLogin } from "~/modules/Dashboard/hooks/useSyncUserAfterLogin";

export default function AuthLayout() {
  const { data: user } = useCurrentUserSessionSuspense();
  useSyncUserAfterLogin(user);

  return (
    <main className="auth-canvas isolate flex min-h-screen w-screen items-center justify-center p-4">
      <MFAGuard mode="auth">
        <Outlet />
      </MFAGuard>
    </main>
  );
}
