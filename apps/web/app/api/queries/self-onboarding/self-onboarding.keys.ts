import { useCurrentUserStore } from "~/modules/common/store/useCurrentUserStore";

export const HELPDESK_QUERY_KEY = "helpdesk";
export const HELPDESK_SEARCH_DEBOUNCE_MS = 400;

/** The catalog is public, but enabled-feature context belongs to the active tenant. */
export function useHelpdeskScope() {
  const targetTenantId = useCurrentUserStore(
    (state) => state.currentUser?.supportContext?.targetTenantId,
  );
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  return targetTenantId ?? origin;
}
