import { useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import { CATEGORIES_QUERY_KEY } from "./useCategories";

type AllCategoriesQuery = NonNullable<
  Parameters<typeof ApiClient.api.categoryControllerGetAllCategories>[0]
>;

export type CategoriesTableParams = Omit<AllCategoriesQuery, "page" | "perPage"> & {
  page: number;
  perPage: number;
};

export const categoriesTableQueryOptions = (params: CategoriesTableParams) => ({
  queryKey: [...CATEGORIES_QUERY_KEY, "table", params],
  queryFn: async () => {
    const response = await ApiClient.api.categoryControllerGetAllCategories(params);

    return response.data;
  },
});

export function useCategoriesTableSuspense(params: CategoriesTableParams) {
  return useSuspenseQuery(categoriesTableQueryOptions(params));
}
