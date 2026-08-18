import { useLocation } from "@remix-run/react";
import { useEffect } from "react";

import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { LOGIN_REDIRECT_URL } from "~/modules/Auth/constants";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

export function useNavigationTracker() {
  const location = useLocation();
  const currentUser = useCurrentUserStore((state) => state.currentUser);

  const addLastUnauthorizedEntry = useNavigationHistoryStore(
    (state) => state.addLastUnauthorizedEntry,
  );
  const lastEntry = useNavigationHistoryStore((state) => state.navigationHistory[0] ?? null);
  const clearHistory = useNavigationHistoryStore((state) => state.clearHistory);

  const isAuthRoute = location.pathname.startsWith("/auth");
  const isRootRoute = location.pathname === LOGIN_REDIRECT_URL;

  useEffect(() => {
    if (currentUser || isAuthRoute || isRootRoute) return;

    addLastUnauthorizedEntry({
      pathname: location.pathname,
      timestamp: Date.now(),
    });
  }, [
    location.pathname,
    location.search,
    addLastUnauthorizedEntry,
    currentUser,
    isAuthRoute,
    isRootRoute,
  ]);

  useEffect(() => {
    if (!currentUser || isAuthRoute || isRootRoute || !lastEntry) return;
    if (lastEntry.pathname !== location.pathname) return;

    clearHistory();
  }, [clearHistory, currentUser, isAuthRoute, isRootRoute, lastEntry, location.pathname]);
}
