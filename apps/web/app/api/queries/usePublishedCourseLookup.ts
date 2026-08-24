import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";
import type { GetPublishedCourseLookupResponse } from "~/api/generated-api";

type PublishedCourseLookupParams = {
  language: SupportedLanguages;
  title?: string;
  perPage?: number;
};

export const publishedCourseLookupQueryOptions = ({
  language,
  title,
  perPage = 20,
}: PublishedCourseLookupParams) => ({
  queryKey: ["published-course-lookup", { language, title, perPage }],
  queryFn: async ({ pageParam }: { pageParam: number }) => {
    const response = await ApiClient.api.courseControllerGetPublishedCourseLookup({
      language,
      page: pageParam,
      perPage,
      ...(title?.trim() ? { title: title.trim() } : {}),
    });

    return response.data;
  },
  getNextPageParam: (lastPage: GetPublishedCourseLookupResponse) => {
    const loadedItems = lastPage.pagination.page * lastPage.pagination.perPage;

    if (loadedItems >= lastPage.pagination.totalItems) return undefined;

    return lastPage.pagination.page + 1;
  },
  initialPageParam: 1,
});

export function usePublishedCourseLookup(
  params: PublishedCourseLookupParams,
  options: { enabled?: boolean } = {},
) {
  return useInfiniteQuery({
    ...publishedCourseLookupQueryOptions(params),
    ...options,
  });
}
