import { queryOptions } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { DirectorySyncProvider } from "@repo/shared";

export const DIRECTORY_SYNC_GROUPS_QUERY_KEY = "directorySyncGroups";

export const directorySyncGroupsQueryOptions = (
  provider: DirectorySyncProvider,
  searchPhrase: string,
  enabled: boolean,
) =>
  queryOptions({
    queryKey: [DIRECTORY_SYNC_GROUPS_QUERY_KEY, provider, searchPhrase],
    queryFn: async () => {
      const response = await ApiClient.api.directorySyncControllerSearchDirectorySyncGroups(
        provider,
        { search: searchPhrase },
      );

      return response.data.data;
    },
    enabled,
    retry: false,
  });
