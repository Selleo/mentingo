import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const INTEGRATION_API_KEY_QUERY_KEY = "integrationApiKey";

export const integrationApiKeyQueryOptions = queryOptions({
  queryKey: [INTEGRATION_API_KEY_QUERY_KEY],
  queryFn: async () => {
    const response = await ApiClient.api.integrationAdminControllerGetCurrentKey();

    return response.data.data;
  },
});

export function useIntegrationApiKey() {
  return useQuery({
    ...integrationApiKeyQueryOptions,
  });
}
