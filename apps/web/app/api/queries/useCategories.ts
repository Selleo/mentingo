import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetAllCategoriesResponse } from "../generated-api";

type CategorySearchParams = {
  title?: string;
  archived?: boolean;
};

export const CATEGORIES_QUERY_KEY = ["categories"];

type QueryOptions = {
  enabled?: boolean;
};

export const categoriesQueryOptions = (
  searchParams?: CategorySearchParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...CATEGORIES_QUERY_KEY, searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.categoryControllerGetAllCategories({
      page: 1,
      perPage: 100,
      ...(searchParams?.title && { title: searchParams.title }),
      ...(searchParams?.archived !== undefined && {
        archived: String(searchParams.archived),
      }),
    });
    return response.data;
  },
  select: (data: GetAllCategoriesResponse) => data.data,
  ...options,
});

export function useCategories(searchParams?: CategorySearchParams) {
  return useQuery(categoriesQueryOptions(searchParams));
}

export function useCategoriesSuspense(searchParams?: CategorySearchParams) {
  return useSuspenseQuery(categoriesQueryOptions(searchParams));
}
