import { useLocation, useNavigate } from "@remix-run/react";
import { useEffect, useRef } from "react";

import { useCurrentUserSuspense } from "~/api/queries/useCurrentUser";
import { MFAGuard } from "~/Guards/MFAGuard";
import { RequireAuthenticatedUser } from "~/Guards/RequireAuthenticatedUser";
import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { Dashboard } from "~/modules/Dashboard/Dashboard";

import { resolvePostAuthRedirectPath } from "../Auth/utils/resolvePostAuthRedirectPath";
import { useCurrentUserStore } from "../common/store/useCurrentUserStore";

export default function UserDashboardLayout() {
  return (
    <RequireAuthenticatedUser>
      <UserDashboardContent />
    </RequireAuthenticatedUser>
  );
}

function UserDashboardContent() {
  const location = useLocation();
  const navigate = useNavigate();

  const { data: user } = useCurrentUserSuspense();
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);
  const lastEntry = useNavigationHistoryStore((state) => state.navigationHistory[0] ?? null);
  const consumeLastUnauthorizedEntry = useNavigationHistoryStore(
    (state) => state.consumeLastUnauthorizedEntry,
  );

  const isAuthenticated = Boolean(user && (!user.shouldVerifyMFA || hasVerifiedMFA));
  const canReturnToDestination = isAuthenticated && !user?.requiresPasswordChange;
  const currentPath = `${location.pathname}${location.search}`;
  const returnFromPath = useRef<string | null>(null);
  const shouldRedirect = Boolean(
    canReturnToDestination &&
      (returnFromPath.current === currentPath ||
        (lastEntry &&
          resolvePostAuthRedirectPath({ pathname: lastEntry.pathname }) !== currentPath)),
  );

  useEffect(() => {
    if (returnFromPath.current !== currentPath) returnFromPath.current = null;
    if (!canReturnToDestination || !lastEntry) return;

    // Consume before navigating so a rejected destination cannot be retried
    // when its route guard sends the user back to this layout.
    const entry = consumeLastUnauthorizedEntry();
    if (!entry) return;

    const destination = resolvePostAuthRedirectPath({ pathname: entry.pathname });
    if (destination !== currentPath) {
      // Keep the default outlet hidden until the return navigation commits.
      // Otherwise clearing history can mount the index redirect in between.
      returnFromPath.current = currentPath;
      navigate(destination, { replace: true });
    }
  }, [canReturnToDestination, consumeLastUnauthorizedEntry, currentPath, lastEntry, navigate]);

  if (shouldRedirect) {
    return null;
  }

  return (
    <MFAGuard mode="app">
      <Dashboard isAuthenticated={isAuthenticated} />
    </MFAGuard>
  );
}
