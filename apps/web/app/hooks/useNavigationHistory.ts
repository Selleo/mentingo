import { useLocation } from "@remix-run/react";
import { useEffect } from "react";

import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";
import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

export function useNavigationTracker() {
  const location = useLocation();
  const currentUser = useCurrentUserStore((state) => state.currentUser);

  const addLastUnauthorizedEntry = useNavigationHistoryStore(
    (state) => state.addLastUnauthorizedEntry,
  );

  const isAuthRoute = location.pathname.startsWith("/auth");
  const isRootRoute = location.pathname === "/";

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
}

export function useNavigationHistory() {
  return useNavigationHistoryStore((state) => ({
    history: state.navigationHistory,
    clearHistory: state.clearHistory,
  }));
}
