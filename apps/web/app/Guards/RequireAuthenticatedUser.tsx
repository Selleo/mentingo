import { Navigate, useLocation } from "@remix-run/react";
import { AUTH_SESSION_STATUS } from "@repo/shared";
import { useLayoutEffect } from "react";

import { useAuthSession } from "~/api/queries/useAuthSession";
import { useCurrentUserSessionSuspense } from "~/api/queries/useCurrentUserSessionSuspense";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { LOGIN_URL, MFA_URL } from "~/modules/Auth/constants";
import { useSyncUserAfterLogin } from "~/modules/Dashboard/hooks/useSyncUserAfterLogin";

import { MFAGuard } from "./MFAGuard";

import type { PropsWithChildren } from "react";

export function RequireAuthenticatedUser({ children }: PropsWithChildren) {
  const { data: user } = useCurrentUserSessionSuspense();

  useSyncUserAfterLogin(user);

  if (!user) return <UnauthenticatedRedirect />;

  return (
    <MFAGuard mode="app">
      <>{children}</>
    </MFAGuard>
  );
}

/**
 * Sends anonymous visitors to login and remembers where they were going. A session awaiting MFA
 * has no user yet, so it continues to verification and keeps the destination saved before login.
 */
function UnauthenticatedRedirect() {
  const { data: session, isLoading } = useAuthSession();
  const { pathname, search } = useLocation();
  const addLastUnauthorizedEntry = useNavigationHistoryStore(
    (state) => state.addLastUnauthorizedEntry,
  );
  const isAwaitingMfa = session?.status === AUTH_SESSION_STATUS.MFA_REQUIRED;

  useLayoutEffect(() => {
    if (isLoading || isAwaitingMfa) return;
    addLastUnauthorizedEntry({ pathname: `${pathname}${search}`, timestamp: Date.now() });
  }, [addLastUnauthorizedEntry, isAwaitingMfa, isLoading, pathname, search]);

  if (isLoading) return null;

  if (isAwaitingMfa) return <Navigate to={MFA_URL} replace />;

  return <Navigate to={LOGIN_URL} replace />;
}
