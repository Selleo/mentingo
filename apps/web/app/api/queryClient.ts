import { QueryClient } from "@tanstack/react-query";
import { isAxiosError, isCancel } from "axios";

export const DEFAULT_STALE_TIME = 1000 * 60 * 5;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: DEFAULT_STALE_TIME,
      retry(failureCount, error: unknown) {
        if (isCancel(error)) return false;

        if (isAxiosError(error) && error.response) return false;

        if (failureCount >= 3) return false;

        return true;
      },
    },
    mutations: {
      retry(failureCount, error: unknown) {
        if (isCancel(error)) return false;

        if (isAxiosError(error) && error.response) return false;

        if (failureCount >= 2) return false;

        return true;
      },
    },
  },
});
