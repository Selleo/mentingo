import { useInfiniteQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import {
  ANNOUNCEMENTS_FOR_USER_QUERY_KEY,
  ANNOUNCEMENTS_PAGE_SIZE,
  type AnnouncementFilters,
} from "./useAnnouncementsForUser";

import type { GetAnnouncementsForUserResponse } from "../generated-api";
import type { InfiniteData } from "@tanstack/react-query";

type QueryOptions = {
  enabled?: boolean;
};

export const getInfiniteAnnouncementsForUserQueryKey = (
  searchParams?: AnnouncementFilters,
  perPage = ANNOUNCEMENTS_PAGE_SIZE,
) => [ANNOUNCEMENTS_FOR_USER_QUERY_KEY, "infinite", searchParams, perPage];

export function useInfiniteAnnouncementsForUser(
  searchParams?: AnnouncementFilters,
  options: QueryOptions = { enabled: true },
) {
  return useInfiniteQuery<
    GetAnnouncementsForUserResponse,
    Error,
    InfiniteData<GetAnnouncementsForUserResponse>,
    ReturnType<typeof getInfiniteAnnouncementsForUserQueryKey>,
    number
  >({
    queryKey: getInfiniteAnnouncementsForUserQueryKey(searchParams),
    queryFn: async ({ pageParam = 1 }) => {
      const { data } = await ApiClient.api.announcementsControllerGetAnnouncementsForUser({
        ...(searchParams?.title && { title: searchParams.title }),
        ...(searchParams?.content && { content: searchParams.content }),
        ...(searchParams?.search && { search: searchParams.search }),
        ...(searchParams?.isRead && { isRead: searchParams.isRead }),
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
