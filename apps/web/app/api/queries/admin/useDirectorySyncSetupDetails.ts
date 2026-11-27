import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { DirectorySyncProvider } from "@repo/shared";

export const DIRECTORY_SYNC_SETUP_DETAILS_QUERY_KEY = "directorySyncSetupDetails";

export const directorySyncSetupDetailsQueryOptions = (provider: DirectorySyncProvider) =>
  queryOptions({
    queryKey: [DIRECTORY_SYNC_SETUP_DETAILS_QUERY_KEY, provider],
    queryFn: async () => {
      const response =
        await ApiClient.api.directorySyncControllerGetDirectorySyncSetupDetails(provider);

      return response.data.data;
    },
    retry: false,
  });

export function useDirectorySyncSetupDetails(provider: DirectorySyncProvider) {
  return useQuery(directorySyncSetupDetailsQueryOptions(provider));
}
