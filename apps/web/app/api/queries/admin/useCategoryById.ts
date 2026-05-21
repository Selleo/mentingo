import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { GetCategoryByIdResponse } from "../../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const CATEGORY_QUERY_KEY = ["category", "admin"] as const;

export const categoryByIdQueryOptions = (id: string, language?: SupportedLanguages) =>
  queryOptions({
    queryKey: [...CATEGORY_QUERY_KEY, id, { language }],
    queryFn: async () => {
      const response = await ApiClient.api.categoryControllerGetCategoryById(id, { language });
      return response.data;
    },
    select: (data: GetCategoryByIdResponse) => data.data,
  });

export function useCategoryById(id: string, language?: SupportedLanguages) {
  return useQuery(categoryByIdQueryOptions(id, language));
}

export function useCategoryByIdSuspense(id: string, language?: SupportedLanguages) {
  return useSuspenseQuery(categoryByIdQueryOptions(id, language));
}
