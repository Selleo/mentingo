import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetPasswordStatusResponse } from "../generated-api";

const PASSWORD_STATUS_QUERY_KEY = "passwordStatus";

export const passwordStatusQueryOptions = queryOptions({
  queryKey: [PASSWORD_STATUS_QUERY_KEY],
  queryFn: async () => {
    const response = await ApiClient.api.userControllerGetPasswordStatus();

    return response.data;
  },
});

export function usePasswordStatusSuspense() {
  return useSuspenseQuery({
    ...passwordStatusQueryOptions,
    select: (data: GetPasswordStatusResponse) => data.data,
  });
}
