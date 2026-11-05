import { AUTH_SESSION_STATUS } from "@repo/shared";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";

import { authSessionQueryOptions, useAuthSession } from "./useAuthSession";

import type { GetUserSettingsResponse } from "../generated-api";

export const userSettingsQueryOptions = queryOptions({
  queryKey: ["userSettings"],
  queryFn: async () => {
    try {
      const session = await queryClient.fetchQuery(authSessionQueryOptions);
      if (session?.status !== AUTH_SESSION_STATUS.AUTHENTICATED) return null;
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
  const { data: session } = useAuthSession();
  return useQuery({
    ...userSettingsQueryOptions,
    enabled: enabled && session?.status === AUTH_SESSION_STATUS.AUTHENTICATED,
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
