import { useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetAllGroupsResponse } from "~/api/generated-api";

export type GroupsSearchParams = {
  name?: string;
  sort?: string;
};

export const GROUPS_QUERY_KEY = "groups";

type QueryOptions = {
  enabled?: boolean;
};

export const useGroupsQuery = (
  searchParams?: GroupsSearchParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [GROUPS_QUERY_KEY, searchParams],
  queryFn: async () => {
    const { data } = await ApiClient.api.groupControllerGetAllGroups({
      ...(searchParams?.name && { name: searchParams.name }),
      ...(searchParams?.sort && { sort: searchParams.sort }),
    });
    return data;
  },
  select: ({ data }: GetAllGroupsResponse) => data,
  ...options,
});

export function useGroupsQuerySuspense(searchParams?: GroupsSearchParams) {
  return useSuspenseQuery(useGroupsQuery(searchParams));
}
