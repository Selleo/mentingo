import { useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetAllGroupsResponse } from "~/api/generated-api";

export type GroupsSearchParams = {
  keyword?: string;
  sort?: string;
};

export const GROUPS_QUERY_KEY = "groups";

export const useGroupsQuery = (searchParams?: GroupsSearchParams) => ({
  queryKey: [GROUPS_QUERY_KEY],
  queryFn: async () => {
    const { data } = await ApiClient.api.groupControllerGetAllGroups({
      ...(searchParams?.keyword && { keyword: searchParams.keyword }),
      ...(searchParams?.sort && { sort: searchParams.sort }),
    });
    return data;
  },
  select: ({ data }: GetAllGroupsResponse) => data,
});

export function useGroupsQuerySuspense(searchParams?: GroupsSearchParams) {
  return useSuspenseQuery(useGroupsQuery(searchParams));
}
