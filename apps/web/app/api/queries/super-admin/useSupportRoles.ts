import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const SUPER_ADMIN_SUPPORT_ROLES_QUERY_KEY = ["super-admin", "support-roles"] as const;

export const supportRolesQueryOptions = (tenantId: string, enabled = true) =>
  queryOptions({
    queryKey: [...SUPER_ADMIN_SUPPORT_ROLES_QUERY_KEY, tenantId],
    enabled,
    queryFn: async () => {
      const response = await ApiClient.api.tenantsControllerFindSupportRoles(tenantId);
      return response.data.data;
    },
  });

export function useSupportRoles(tenantId: string, enabled = true) {
  return useQuery(supportRolesQueryOptions(tenantId, enabled));
}
