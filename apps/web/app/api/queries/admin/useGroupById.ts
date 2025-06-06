import { useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";

import type { GetGroupByIdResponse } from "~/api/generated-api";

export const useGroupByIdQuery = (groupId: string) => ({
  queryKey: [GROUPS_QUERY_KEY, { groupId }],
  queryFn: async () => {
    const { data } = await ApiClient.api.groupControllerGetGroupById(groupId);
    return data;
  },
  select: ({ data }: GetGroupByIdResponse) => data,
});

export function useGroupByIdQuerySuspense(groupId: string) {
  return useSuspenseQuery(useGroupByIdQuery(groupId));
}
