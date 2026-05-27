import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { ANNOUNCEMENTS_PAGE_SIZE } from "~/api/queries/useAnnouncementsForUser";

import { ALL_ANNOUNCEMENTS_QUERY_KEY, type AllAnnouncementsParams } from "./useAllAnnouncements";

import type { GetAllAnnouncementsResponse } from "../../generated-api";
import type { InfiniteData } from "@tanstack/react-query";

type QueryOptions = {
  enabled?: boolean;
};

export const getInfiniteAllAnnouncementsQueryKey = (
  searchParams?: AllAnnouncementsParams,
  perPage = ANNOUNCEMENTS_PAGE_SIZE,
) => [ALL_ANNOUNCEMENTS_QUERY_KEY, "infinite", searchParams, perPage];

export function useInfiniteAllAnnouncements(
  searchParams?: AllAnnouncementsParams,
  options: QueryOptions = { enabled: true },
) {
  return useInfiniteQuery<
    GetAllAnnouncementsResponse,
    Error,
    InfiniteData<GetAllAnnouncementsResponse>,
    ReturnType<typeof getInfiniteAllAnnouncementsQueryKey>,
    number
  >({
    queryKey: getInfiniteAllAnnouncementsQueryKey(searchParams),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await ApiClient.api.announcementsControllerGetAllAnnouncements({
        ...(searchParams?.language && { language: searchParams.language }),
        page: pageParam,
        perPage: ANNOUNCEMENTS_PAGE_SIZE,
      });

      return data;
    },
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, perPage, totalItems } = lastPage.pagination;
      const nextPage = page + 1;

      return nextPage <= Math.ceil(totalItems / perPage) ? nextPage : undefined;
    },
    ...options,
  });
}
