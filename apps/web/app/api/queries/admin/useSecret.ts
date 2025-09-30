import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const secretQueryOptions = (secretName: string, viewSecret: boolean) =>
  queryOptions({
    enabled: viewSecret,
    queryKey: ["secrets", { secretName }],
    queryFn: async () => {
      const response = await ApiClient.api.envControllerGetEnvKey(secretName);
      return response.data;
    },
  });

export function useSecret(secretName: string, viewSecret: boolean) {
  return useQuery(secretQueryOptions(secretName, viewSecret));
}
