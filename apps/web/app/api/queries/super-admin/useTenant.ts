import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { FindTenantByIdResponse } from "~/api/generated-api";

export const SUPER_ADMIN_TENANT_QUERY_KEY = ["super-admin", "tenant"] as const;

export const tenantQueryOptions = (id: string) =>
  queryOptions({
    enabled: Boolean(id),
    queryKey: [...SUPER_ADMIN_TENANT_QUERY_KEY, id],
    queryFn: async () => {
      const response = await ApiClient.api.tenantsControllerFindTenantById(id);
      return response.data;
    },
    select: (data: FindTenantByIdResponse) => data.data,
  });

export function useTenant(id: string) {
  return useQuery(tenantQueryOptions(id));
}
