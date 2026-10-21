import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetLoginMethodSetupResponse } from "~/api/generated-api";

export const LOGIN_METHOD_SETUP_QUERY_KEY = ["admin", "loginMethodSetup"];

export const loginMethodSetupQueryOptions = () =>
  queryOptions({
    queryKey: LOGIN_METHOD_SETUP_QUERY_KEY,
    queryFn: async () => {
      const response = await ApiClient.api.envControllerGetLoginMethodSetup();

      return response.data;
    },
    select: (data: GetLoginMethodSetupResponse) => data.data,
  });

export function useLoginMethodSetup() {
  return useQuery(loginMethodSetupQueryOptions());
}
