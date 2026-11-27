import {
  DIRECTORY_SYNC_RUN_STATUSES,
  type DirectorySyncProvider,
  type DirectorySyncRunStatus,
} from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const DIRECTORY_SYNC_CONNECTION_QUERY_KEY = "directorySyncConnection";

const UNFINISHED_RUN_POLL_INTERVAL_MILLISECONDS = 3000;

const UNFINISHED_RUN_STATUSES: DirectorySyncRunStatus[] = [
  DIRECTORY_SYNC_RUN_STATUSES.QUEUED,
  DIRECTORY_SYNC_RUN_STATUSES.RUNNING,
];

export const isDirectorySyncRunUnfinished = (status: DirectorySyncRunStatus) =>
  UNFINISHED_RUN_STATUSES.includes(status);

export const directorySyncConnectionQueryOptions = (provider: DirectorySyncProvider) =>
  queryOptions({
    queryKey: [DIRECTORY_SYNC_CONNECTION_QUERY_KEY, provider],
    queryFn: async () => {
      const response =
        await ApiClient.api.directorySyncControllerGetDirectorySyncConnection(provider);

      return response.data.data;
    },
    refetchInterval: (query) => {
      const latestRunStatus = query.state.data?.latestRun?.status;

      return latestRunStatus && isDirectorySyncRunUnfinished(latestRunStatus)
        ? UNFINISHED_RUN_POLL_INTERVAL_MILLISECONDS
        : false;
    },
  });

export function useDirectorySyncConnection(provider: DirectorySyncProvider) {
  return useQuery(directorySyncConnectionQueryOptions(provider));
}
