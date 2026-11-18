import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const INTEGRATION_API_KEYS_QUERY_KEY = "integrationApiKeys";

export const integrationApiKeysQueryOptions = queryOptions({
  queryKey: [INTEGRATION_API_KEYS_QUERY_KEY],
  queryFn: async () => {
    const response = await ApiClient.api.integrationAdminControllerGetKeys();

    return response.data.data;
  },
});

export function useIntegrationApiKeys() {
  return useQuery(integrationApiKeysQueryOptions);
}
