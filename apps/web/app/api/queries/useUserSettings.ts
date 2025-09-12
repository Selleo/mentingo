import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "../api-client";

import type { GetUserSettingsResponse } from "../generated-api";

export const userSettingsQueryOptions = queryOptions({
  queryKey: ["userSettings"],
  queryFn: async () => {
    try {
      const response = await ApiClient.api.settingsControllerGetUserSettings();

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

export function useUserSettings(enabled: boolean = true) {
  return useQuery({
    ...userSettingsQueryOptions,
    enabled,
    select: (data: GetUserSettingsResponse | null) => {
      return data?.data;
    },
  });
}

export function useUserSettingsSuspense() {
  return useSuspenseQuery({
    ...userSettingsQueryOptions,
    select: (data: GetUserSettingsResponse | null) => {
      if (!data) {
        throw new Error("User not authenticated");
      }

      return data?.data;
    },
  });
}
