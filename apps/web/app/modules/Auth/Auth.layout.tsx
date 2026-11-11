import { Outlet } from "@remix-run/react";

import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { MFAGuard } from "~/Guards/MFAGuard";
import { useSyncUserAfterLogin } from "~/modules/Dashboard/hooks/useSyncUserAfterLogin";

export default function AuthLayout() {
  const { data: user } = useCurrentUserSessionSuspense();
  useSyncUserAfterLogin(user);

  return (
    <main className="flex min-h-screen w-screen items-center justify-center">
      <MFAGuard mode="auth">
        <Outlet />
      </MFAGuard>
    </main>
  );
}
