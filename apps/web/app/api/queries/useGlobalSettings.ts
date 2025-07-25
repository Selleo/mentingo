import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "../api-client";

import type { GlobalSettingsResponse } from "../generated-api";

export const globalSettingsQueryOptions = queryOptions({
  queryKey: ["globalSettings"],
  queryFn: async () => {
    try {
      const response = await ApiClient.api.globalSettings();

      return response.data;
    } catch (error) {
      if (isAxiosError(error) && error.response?.status === 401) {
        return null;
      }
      throw error;
    }
  },
  staleTime: 1000 * 60 * 5,
});

export function useGlobalSettings() {
  return useQuery({
    ...globalSettingsQueryOptions,
    select: (data: GlobalSettingsResponse | null) => {
      return data?.data?.settings;
    },
  });
}

export function useGlobalSettingsSuspense() {
  return useSuspenseQuery({
    ...globalSettingsQueryOptions,
    select: (data: GlobalSettingsResponse | null) => {
      if (!data) {
        throw new Error("User not authenticated");
      }

      return data?.data.settings;
    },
  });
}
