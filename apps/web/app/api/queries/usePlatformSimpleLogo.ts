import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetPlatformSimpleLogoResponse } from "../generated-api";

export const platformSimpleLogoQueryOptions = () => ({
  queryKey: ["platform-simple-logo"],
  queryFn: async () => {
    const response = await ApiClient.api.settingsControllerGetPlatformSimpleLogo();
    return response.data;
  },
  select: (data: GetPlatformSimpleLogoResponse) => data.data.url,
});

export function usePlatformSimpleLogo() {
  return useQuery(platformSimpleLogoQueryOptions());
}

export function usePlatformSimpleLogoSuspense() {
  return useSuspenseQuery(platformSimpleLogoQueryOptions());
}
