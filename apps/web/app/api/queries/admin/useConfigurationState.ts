import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetIsConfigSetupResponse } from "../../generated-api";

export const CONFIGURATION_STATE_QUERY_KEY = ["admin", "configuration-state"];

interface ConfigurationStateQueryOptionsType {
  enabled: boolean;
}

export const useConfigurationStateQueryOptions = ({
  enabled,
}: ConfigurationStateQueryOptionsType) =>
  queryOptions({
    queryKey: CONFIGURATION_STATE_QUERY_KEY,
    queryFn: async () => {
      const response = await ApiClient.api.envControllerGetIsConfigSetup();

      return response.data;
    },
    enabled,
    select: (data: GetIsConfigSetupResponse) => data.data,
  });

export function useConfigurationState({ enabled }: ConfigurationStateQueryOptionsType) {
  return useQuery(useConfigurationStateQueryOptions({ enabled }));
}

export function useConfigurationStateSuspense({ enabled }: ConfigurationStateQueryOptionsType) {
  return useSuspenseQuery(useConfigurationStateQueryOptions({ enabled }));
}
