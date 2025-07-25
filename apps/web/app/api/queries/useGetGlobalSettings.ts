import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetGlobalSettingsResponse } from "../generated-api";

export const globalSettingsQueryOptions = queryOptions({
  queryKey: ["global-settings"],
  queryFn: async () => {
    const response = await ApiClient.api.settingsControllerGetGlobalSettings();

    return response.data;
  },
  select: (response: GetGlobalSettingsResponse) => response.data,
});

export function useGetGlobalSettings() {
  return useQuery(globalSettingsQueryOptions);
}

export function useGetGlobalSettingsSuspense() {
  return useSuspenseQuery(globalSettingsQueryOptions);
}
