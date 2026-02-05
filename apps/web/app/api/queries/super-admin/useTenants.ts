import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { ListTenantsResponse } from "~/api/generated-api";

export const SUPER_ADMIN_TENANTS_QUERY_KEY = ["super-admin", "tenants"] as const;

export const tenantsQueryOptions = (params: { page?: number; perPage?: number; search?: string }) =>
  queryOptions({
    queryKey: [...SUPER_ADMIN_TENANTS_QUERY_KEY, params],
    queryFn: async () => {
      const response = await ApiClient.api.tenantsControllerListTenants(params);
      return response.data;
    },
    select: (data: ListTenantsResponse) => data,
  });

export function useTenants(params: { page?: number; perPage?: number; search?: string }) {
  return useQuery(tenantsQueryOptions(params));
}
