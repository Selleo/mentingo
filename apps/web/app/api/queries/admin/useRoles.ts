import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetRolesResponse } from "~/api/generated-api";

export const ROLES_QUERY_KEY = "roles";
export type RoleOption = GetRolesResponse["data"][number];

type QueryOptions = {
  enabled?: boolean;
};

export const rolesQueryOptions = (options: QueryOptions = { enabled: true }) => ({
  queryKey: [ROLES_QUERY_KEY],
  queryFn: async () => {
    const { data } = await ApiClient.api.userControllerGetRoles();
    return data;
  },
  select: ({ data }: GetRolesResponse) => data,
  ...options,
});

export function useRoles() {
  return useQuery(rolesQueryOptions());
}

export function useRolesSuspense() {
  return useSuspenseQuery(rolesQueryOptions());
}
