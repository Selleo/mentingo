import { useInfiniteQuery, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type {
  GetAllCategoriesResponse,
  GetAvailableCourseCategoriesResponse,
} from "../generated-api";
import type { AvailableCourseCategorySearchParams } from "../types";
import type { SupportedLanguages } from "@repo/shared";

type CategorySearchParams = {
  title?: string;
  archived?: boolean;
  language?: SupportedLanguages;
};

export const CATEGORIES_QUERY_KEY = ["categories"];
export const AVAILABLE_COURSE_CATEGORIES_QUERY_KEY = ["available-course-categories"];
export const CATEGORIES_PAGE_SIZE = 4;

type QueryOptions = {
  enabled?: boolean;
};

const getCategoriesRequestParams = (
  searchParams: CategorySearchParams | undefined,
  page: number,
  perPage: number,
) => ({
  page,
  perPage,
  ...(searchParams?.title && { title: searchParams.title }),
  ...(searchParams?.archived !== undefined && {
    archived: String(searchParams.archived),
  }),
  ...(searchParams?.language && { language: searchParams.language }),
});

export const categoriesQueryOptions = (
  searchParams?: CategorySearchParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...CATEGORIES_QUERY_KEY, searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.categoryControllerGetAllCategories(
      getCategoriesRequestParams(searchParams, 1, 100),
    );
    return response.data;
  },
  select: (data: GetAllCategoriesResponse) => data.data,
  ...options,
});

export const infiniteCategoriesQueryOptions = (
  searchParams?: CategorySearchParams,
  perPage = CATEGORIES_PAGE_SIZE,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...CATEGORIES_QUERY_KEY, "infinite", searchParams, perPage],
  queryFn: async ({ pageParam }: { pageParam: number }) => {
    const response = await ApiClient.api.categoryControllerGetAllCategories(
      getCategoriesRequestParams(searchParams, pageParam, perPage),
    );

    return response.data;
  },
  getNextPageParam: (lastPage: GetAllCategoriesResponse) => {
    const loadedItems = lastPage.pagination.page * lastPage.pagination.perPage;

    if (loadedItems >= lastPage.pagination.totalItems) return undefined;

    return lastPage.pagination.page + 1;
  },
  initialPageParam: 1,
  ...options,
});

const getAvailableCourseCategoriesRequestParams = (
  searchParams: AvailableCourseCategorySearchParams | undefined,
  page: number,
  perPage: number,
) => ({
  page,
  perPage,
  ...(searchParams?.title && { title: searchParams.title }),
  ...(searchParams?.description && { description: searchParams.description }),
  ...(searchParams?.searchQuery && { searchQuery: searchParams.searchQuery }),
  ...(searchParams?.category && { category: searchParams.category }),
  ...(searchParams?.author && { author: searchParams.author }),
  ...(searchParams?.sort && { sort: searchParams.sort }),
  ...(searchParams?.excludeCourseId && { excludeCourseId: searchParams.excludeCourseId }),
  ...(searchParams?.language && { language: searchParams.language }),
});

export const infiniteAvailableCourseCategoriesQueryOptions = (
  searchParams?: AvailableCourseCategorySearchParams,
  perPage = CATEGORIES_PAGE_SIZE,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [...AVAILABLE_COURSE_CATEGORIES_QUERY_KEY, "infinite", searchParams, perPage],
  queryFn: async ({ pageParam }: { pageParam: number }) => {
    const response = await ApiClient.api.courseControllerGetAvailableCourseCategories(
      getAvailableCourseCategoriesRequestParams(searchParams, pageParam, perPage),
    );

    return response.data;
  },
  getNextPageParam: (lastPage: GetAvailableCourseCategoriesResponse) => {
    const loadedItems = lastPage.pagination.page * lastPage.pagination.perPage;

    if (loadedItems >= lastPage.pagination.totalItems) return undefined;

    return lastPage.pagination.page + 1;
  },
  initialPageParam: 1,
  ...options,
});

export function useCategories(searchParams?: CategorySearchParams) {
  return useQuery(categoriesQueryOptions(searchParams));
}

export function useCategoriesSuspense(searchParams?: CategorySearchParams) {
  return useSuspenseQuery(categoriesQueryOptions(searchParams));
}

export function useInfiniteCategories(
  searchParams?: CategorySearchParams,
  perPage = CATEGORIES_PAGE_SIZE,
  options: QueryOptions = { enabled: true },
) {
  return useInfiniteQuery(infiniteCategoriesQueryOptions(searchParams, perPage, options));
}

export function useInfiniteAvailableCourseCategories(
  searchParams?: AvailableCourseCategorySearchParams,
  perPage = CATEGORIES_PAGE_SIZE,
  options: QueryOptions = { enabled: true },
) {
  return useInfiniteQuery(
    infiniteAvailableCourseCategoriesQueryOptions(searchParams, perPage, options),
  );
}
