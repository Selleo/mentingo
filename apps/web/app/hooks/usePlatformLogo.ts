import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { DEFAULT_STALE_TIME } from "~/api/queryClient";

export function usePlatformLogo() {
  return useQuery({
    queryKey: ["platform-logo"],
    queryFn: async () => {
      try {
        const response = await ApiClient.api.settingsControllerGetPlatformLogo();
        return response.data.data.url;
      } catch (error) {
        console.warn("Failed to fetch platform logo:", error);
        return null;
      }
    },
    staleTime: DEFAULT_STALE_TIME,
    retry: 1,
    refetchOnWindowFocus: false,
  });
}
