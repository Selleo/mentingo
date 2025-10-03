import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetUsersResponse } from "../generated-api";
import type { UserRole } from "~/config/userRoles";

export type UsersParams = {
  keyword?: string;
  role?: UserRole;
  archived?: boolean;
  sort?: string;
  groupId?: string;
};

type QueryOptions = {
  enabled?: boolean;
};

export const usersQueryOptions = (
  searchParams?: UsersParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: ["users", searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.userControllerGetUsers({
      page: 1,
      perPage: 100,
      ...(searchParams?.keyword && { keyword: searchParams.keyword }),
      ...(searchParams?.role && { role: searchParams.role }),
      ...(searchParams?.archived !== undefined && {
        archived: String(searchParams.archived),
      }),
      ...(searchParams?.groupId && { groupId: searchParams.groupId }),
      ...(searchParams?.sort && { sort: searchParams.sort }),
    });
    return response.data;
  },
  select: (data: GetUsersResponse) => data.data,
  ...options,
});

export function useAllUsers(searchParams?: UsersParams) {
  return useQuery(usersQueryOptions(searchParams));
}

export function useAllUsersSuspense(searchParams?: UsersParams) {
  return useSuspenseQuery(usersQueryOptions(searchParams));
}
