import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { DirectorySyncProvider } from "@repo/shared";

export const DIRECTORY_SYNC_RUNS_QUERY_KEY = "directorySyncRuns";

export const directorySyncRunsQueryOptions = (
  provider: DirectorySyncProvider,
  page: number,
  perPage: number,
  enabled: boolean,
) =>
  queryOptions({
    queryKey: [DIRECTORY_SYNC_RUNS_QUERY_KEY, provider, page, perPage],
    queryFn: async () => {
      const response = await ApiClient.api.directorySyncControllerListDirectorySyncRuns(provider, {
        page,
        perPage,
      });

      return response.data;
    },
    enabled,
    placeholderData: keepPreviousData,
  });

export function useDirectorySyncRuns(
  provider: DirectorySyncProvider,
  page: number,
  perPage: number,
  enabled: boolean,
) {
  return useQuery(directorySyncRunsQueryOptions(provider, page, perPage, enabled));
}
