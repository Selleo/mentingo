import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { GROUPS_QUERY_KEY } from "~/api/queries/admin/useGroups";

import type { SupportedLanguages } from "@repo/shared";
import type { GetGroupByIdResponse } from "~/api/generated-api";

export const useGroupByIdQuery = (groupId: string, language?: SupportedLanguages) => ({
  queryKey: [GROUPS_QUERY_KEY, { groupId, language }],
  queryFn: async () => {
    const { data } = await ApiClient.api.groupControllerGetGroupById(groupId, { language });
    return data;
  },
  select: ({ data }: GetGroupByIdResponse) => data,
});

export function useGroupByIdQuerySuspense(groupId: string, language?: SupportedLanguages) {
  return useSuspenseQuery(useGroupByIdQuery(groupId, language));
}

export function useGroupById(groupId: string, language?: SupportedLanguages) {
  return useQuery(useGroupByIdQuery(groupId, language));
}
