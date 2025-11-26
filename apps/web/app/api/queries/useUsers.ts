import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetUsersResponse } from "../generated-api";
import type { Option } from "~/components/ui/multiselect";
import type { UserRole } from "~/config/userRoles";

const SORTABLE_FIELDS = ["firstName", "lastName", "email", "groupName", "createdAt"] as const;

type UsersSortField = (typeof SORTABLE_FIELDS)[number];
type UsersSort = UsersSortField | `-${UsersSortField}`;

export type UsersParams = {
  keyword?: string;
  role?: UserRole;
  archived?: boolean;
  sort?: UsersSort;
  groups?: Option[];
  page?: number;
  perPage?: number;
};

type QueryOptions = {
  enabled?: boolean;
};

export const usersQueryOptions = (
  searchParams?: UsersParams,
  options: QueryOptions = { enabled: true },
) => ({
  placeholderData: (previousData: GetUsersResponse | undefined) => previousData,
  queryKey: ["users", searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.userControllerGetUsers({
      page: searchParams?.page || 1,
      perPage: searchParams?.perPage || 10,
      ...(searchParams?.keyword && { keyword: searchParams.keyword }),
      ...(searchParams?.role && { role: searchParams.role }),
      ...(searchParams?.archived !== undefined && {
        archived: String(searchParams.archived),
      }),
      ...(searchParams?.sort && { sort: searchParams.sort }),
      ...(searchParams?.groups && { groups: searchParams.groups.map(({ value }) => value) }),
    });
    return response.data;
  },
  ...options,
});

export function useAllUsers(searchParams?: UsersParams) {
  return useQuery(usersQueryOptions(searchParams));
}

export function useAllUsersSuspense(searchParams?: UsersParams) {
  return useSuspenseQuery(usersQueryOptions(searchParams));
}
