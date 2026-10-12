import { useLocation } from "@remix-run/react";
import { useEffect } from "react";

import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { LOGIN_REDIRECT_URL } from "~/modules/Auth/constants";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

export function useNavigationTracker() {
  const location = useLocation();
  const currentUser = useCurrentUserStore((state) => state.currentUser);
  const hasVerifiedMFA = useCurrentUserStore((state) => state.hasVerifiedMFA);

  const addLastUnauthorizedEntry = useNavigationHistoryStore(
    (state) => state.addLastUnauthorizedEntry,
  );
  const lastEntry = useNavigationHistoryStore((state) => state.navigationHistory[0] ?? null);
  const clearHistory = useNavigationHistoryStore((state) => state.clearHistory);

  const isAuthRoute = location.pathname.startsWith("/auth");
  const isLandingRoute = location.pathname === "/" || location.pathname === LOGIN_REDIRECT_URL;

  useEffect(() => {
    if (useCurrentUserStore.getState().currentUser || isAuthRoute || isLandingRoute) return;

    addLastUnauthorizedEntry({
      pathname: `${location.pathname}${location.search}`,
      timestamp: Date.now(),
    });
  }, [
    location.pathname,
    location.search,
    addLastUnauthorizedEntry,
    currentUser,
    isAuthRoute,
    isLandingRoute,
  ]);

  useEffect(() => {
    const session = useCurrentUserStore.getState();
    const user = session.currentUser;
    if (!user || isAuthRoute || !lastEntry) return;
    if (user.requiresPasswordChange || (user.shouldVerifyMFA && !session.hasVerifiedMFA)) {
      return;
    }
    if (lastEntry.pathname !== `${location.pathname}${location.search}`) return;

    clearHistory();
  }, [
    clearHistory,
    currentUser,
    hasVerifiedMFA,
    isAuthRoute,
    lastEntry,
    location.pathname,
    location.search,
  ]);
}
