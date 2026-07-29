import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { FindAllTenantsResponse } from "~/api/generated-api";

export const SUPER_ADMIN_TENANTS_QUERY_KEY = ["super-admin", "tenants"] as const;

export type TenantsQueryParams = NonNullable<
  Parameters<typeof ApiClient.api.tenantsControllerFindAllTenants>[0]
>;

export const tenantsQueryOptions = (params: TenantsQueryParams, enabled = true) =>
  queryOptions({
    queryKey: [...SUPER_ADMIN_TENANTS_QUERY_KEY, params],
    enabled,
    queryFn: async () => {
      const response = await ApiClient.api.tenantsControllerFindAllTenants(params);
      return response.data;
    },
    select: (data: FindAllTenantsResponse) => data,
  });

export function useTenants(params: TenantsQueryParams, enabled = true) {
  return useQuery(tenantsQueryOptions(params, enabled));
}

export function useTenantsSuspense(params: TenantsQueryParams) {
  return useSuspenseQuery(tenantsQueryOptions(params));
}
