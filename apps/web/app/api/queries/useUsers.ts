import { useInfiniteQuery, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetUsersResponse } from "../generated-api";
import type { Option } from "~/components/ui/multiselect";

const SORTABLE_FIELDS = ["firstName", "lastName", "email", "groupName", "createdAt"] as const;

type UsersSortField = (typeof SORTABLE_FIELDS)[number];
type UsersSort = UsersSortField | `-${UsersSortField}`;

export type UsersParams = {
  keyword?: string;
  role?: string;
  archived?: boolean;
  sort?: UsersSort;
  groups?: Option[];
  page?: number;
  perPage?: number;
};

type QueryOptions = {
  enabled?: boolean;
};

const getUsersRequestParams = (searchParams: UsersParams | undefined, page: number) => ({
  page,
  perPage: searchParams?.perPage || 10,
  ...(searchParams?.keyword && { keyword: searchParams.keyword }),
  ...(searchParams?.role && { roleSlug: searchParams.role }),
  ...(searchParams?.archived !== undefined && {
    archived: String(searchParams.archived),
  }),
  ...(searchParams?.sort && { sort: searchParams.sort }),
  ...(searchParams?.groups && { groups: searchParams.groups.map(({ value }) => value) }),
});

export const usersQueryOptions = (
  searchParams?: UsersParams,
  options: QueryOptions = { enabled: true },
) => ({
  placeholderData: (previousData: GetUsersResponse | undefined) => previousData,
  queryKey: ["users", searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.userControllerGetUsers(
      getUsersRequestParams(searchParams, searchParams?.page || 1),
    );
    return response.data;
  },
  ...options,
});

export const infiniteUsersQueryOptions = (
  searchParams?: UsersParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: ["users", "infinite", searchParams],
  queryFn: async ({ pageParam }: { pageParam: number }) => {
    const response = await ApiClient.api.userControllerGetUsers(
      getUsersRequestParams(searchParams, pageParam),
    );
    return response.data;
  },
  getNextPageParam: (lastPage: GetUsersResponse) => {
    const loadedItems = lastPage.pagination.page * lastPage.pagination.perPage;

    if (loadedItems >= lastPage.pagination.totalItems) return undefined;

    return lastPage.pagination.page + 1;
  },
  initialPageParam: 1,
  ...options,
});

export function useAllUsers(searchParams?: UsersParams) {
  return useQuery(usersQueryOptions(searchParams));
}

export function useAllUsersSuspense(searchParams?: UsersParams) {
  return useSuspenseQuery(usersQueryOptions(searchParams));
}

export function useInfiniteUsers(
  searchParams?: UsersParams,
  options: QueryOptions = { enabled: true },
) {
  return useInfiniteQuery(infiniteUsersQueryOptions(searchParams, options));
}
