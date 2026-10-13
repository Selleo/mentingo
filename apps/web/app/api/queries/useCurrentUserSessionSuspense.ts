import { useSuspenseQuery } from "@tanstack/react-query";

import { currentUserQueryOptions } from "./useCurrentUser";

// Public and auth routes must be able to distinguish an anonymous session
// from a request failure without throwing for an expected 401 response.
export function useCurrentUserSessionSuspense() {
  return useSuspenseQuery({
    ...currentUserQueryOptions,
    select: (response) => response?.data ?? null,
  });
}
