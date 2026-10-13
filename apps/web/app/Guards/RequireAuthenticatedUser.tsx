import { Navigate, useLocation } from "@remix-run/react";
import { useLayoutEffect } from "react";

import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { useSyncUserAfterLogin } from "~/modules/Dashboard/hooks/useSyncUserAfterLogin";

import { MFAGuard } from "./MFAGuard";

import type { PropsWithChildren } from "react";

export function RequireAuthenticatedUser({ children }: PropsWithChildren) {
  const { data: user } = useCurrentUserSessionSuspense();
  const { pathname, search } = useLocation();
  const addLastUnauthorizedEntry = useNavigationHistoryStore(
    (state) => state.addLastUnauthorizedEntry,
  );

  useSyncUserAfterLogin(user);

  useLayoutEffect(() => {
    if (user) return;
    addLastUnauthorizedEntry({ pathname: `${pathname}${search}`, timestamp: Date.now() });
  }, [addLastUnauthorizedEntry, pathname, search, user]);

  if (!user) return <Navigate to="/auth/login" replace />;

  return (
    <MFAGuard mode="app">
      <>{children}</>
    </MFAGuard>
  );
}
