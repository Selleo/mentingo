import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { DirectorySyncProvider } from "@repo/shared";

export const DIRECTORY_SYNC_ORGANIZATIONAL_UNITS_QUERY_KEY = "directorySyncOrganizationalUnits";

export const directorySyncOrganizationalUnitsQueryOptions = (
  provider: DirectorySyncProvider,
  enabled: boolean,
) =>
  queryOptions({
    queryKey: [DIRECTORY_SYNC_ORGANIZATIONAL_UNITS_QUERY_KEY, provider],
    queryFn: async () => {
      const response =
        await ApiClient.api.directorySyncControllerListDirectorySyncOrganizationalUnits(provider);

      return response.data.data;
    },
    enabled,
    retry: false,
  });

export function useDirectorySyncOrganizationalUnits(
  provider: DirectorySyncProvider,
  enabled: boolean,
) {
  return useQuery(directorySyncOrganizationalUnitsQueryOptions(provider, enabled));
}
