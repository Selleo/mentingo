import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { FindSupportUsersResponse } from "~/api/generated-api";

export const SUPER_ADMIN_SUPPORT_USERS_QUERY_KEY = ["super-admin", "support-users"] as const;

type SupportUsersParams = {
  tenantId: string;
  perPage?: number;
  search?: string;
};

type QueryOptions = {
  enabled?: boolean;
};

export const supportUsersQueryOptions = (
  { tenantId, perPage = 20, search }: SupportUsersParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...SUPER_ADMIN_SUPPORT_USERS_QUERY_KEY, tenantId, { perPage, search }],
  queryFn: async ({ pageParam }: { pageParam: number }) => {
    const response = await ApiClient.api.tenantsControllerFindSupportUsers(tenantId, {
      page: pageParam,
      perPage,
      ...(search?.trim() && { search: search.trim() }),
    });

    return response.data;
  },
  getNextPageParam: (lastPage: FindSupportUsersResponse) => {
    const loadedItems = lastPage.pagination.page * lastPage.pagination.perPage;

    if (loadedItems >= lastPage.pagination.totalItems) return undefined;

    return lastPage.pagination.page + 1;
  },
  initialPageParam: 1,
  ...options,
});

export function useSupportUsers(params: SupportUsersParams, options?: QueryOptions) {
  return useInfiniteQuery(supportUsersQueryOptions(params, options));
}
