import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetUserByIdResponse } from "../../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const userQueryOptions = (id: string, language?: SupportedLanguages) =>
  queryOptions({
    queryKey: ["users", "admin", { id, language }],
    queryFn: async () => {
      const query = { id, language } as Parameters<
        typeof ApiClient.api.userControllerGetUserById
      >[0];
      const response = await ApiClient.api.userControllerGetUserById(query);
      return response.data;
    },
    select: (data: GetUserByIdResponse) => data.data,
  });

export function useUserById(id: string, language?: SupportedLanguages) {
  return useQuery(userQueryOptions(id, language));
}

export function useUserByIdSuspense(id: string, language?: SupportedLanguages) {
  return useSuspenseQuery(userQueryOptions(id, language));
}
