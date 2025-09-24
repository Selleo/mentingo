import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "../api-client";

import type { GetPublicGlobalSettingsResponse } from "../generated-api";

export const globalSettingsQueryOptions = queryOptions({
  queryKey: ["globalSettings"],
  queryFn: async () => {
    try {
      const response = await ApiClient.api.settingsControllerGetPublicGlobalSettings();

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
    select: (data: GetPublicGlobalSettingsResponse | null) => {
      return data?.data;
    },
  });
}

export function useGlobalSettingsSuspense() {
  return useSuspenseQuery({
    ...globalSettingsQueryOptions,
    select: (data: GetPublicGlobalSettingsResponse | null) => {
      if (!data) {
        throw new Error("User not authenticated");
      }

      return data?.data;
    },
  });
}
