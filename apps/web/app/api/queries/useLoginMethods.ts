import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetLoginMethodsResponse } from "~/api/generated-api";

export const LOGIN_METHODS_QUERY_KEY = ["loginMethods"];

export const loginMethodsQueryOptions = () =>
  queryOptions({
    queryKey: LOGIN_METHODS_QUERY_KEY,
    queryFn: async () => {
      const response = await ApiClient.api.envControllerGetLoginMethods();

      return response.data;
    },
    select: (data: GetLoginMethodsResponse) => data.data,
  });

export function useLoginMethods() {
  return useQuery(loginMethodsQueryOptions());
}
