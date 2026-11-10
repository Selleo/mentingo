import { useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import { GROUPS_QUERY_KEY } from "./useGroups";

type AllGroupsQuery = NonNullable<Parameters<typeof ApiClient.api.groupControllerGetAllGroups>[0]>;

export type GroupsTableParams = Omit<AllGroupsQuery, "page" | "perPage"> & {
  page: number;
  perPage: number;
};

/** One server-side page of the groups table; sharing the groups key keeps invalidation intact. */
export const groupsTableQueryOptions = (params: GroupsTableParams) => ({
  queryKey: [GROUPS_QUERY_KEY, "table", params],
  queryFn: async () => {
    const response = await ApiClient.api.groupControllerGetAllGroups(params);

    return response.data;
  },
});

export function useGroupsTableSuspense(params: GroupsTableParams) {
  return useSuspenseQuery(groupsTableQueryOptions(params));
}
