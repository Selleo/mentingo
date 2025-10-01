import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const ssoEnabledQueryOptions = () =>
  queryOptions({
    queryKey: ["ssoEnabled"],
    queryFn: async () => {
      const response = await ApiClient.api.envControllerGetFrontendSsoEnabled();

      return response.data;
    },
  });

export function useSSOEnabled() {
  return useQuery(ssoEnabledQueryOptions());
}
