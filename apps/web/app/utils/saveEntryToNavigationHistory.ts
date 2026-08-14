import { useNavigationHistoryStore } from "~/lib/stores/navigationHistory";

export const saveEntryToNavigationHistory = (request: Request) => {
  const attemptedUrl = new URL(request.url);

  useNavigationHistoryStore.getState().addLastUnauthorizedEntry({
    pathname: attemptedUrl.pathname,
    timestamp: Date.now(),
  });
};
