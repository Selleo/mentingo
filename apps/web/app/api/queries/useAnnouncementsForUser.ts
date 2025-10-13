import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetAnnouncementsForUserResponse } from "../generated-api";

export type AnnouncementFilters = {
  title?: string;
  content?: string;
  authorName?: string;
  search?: string;
  isRead?: string;
};

type QueryOptions = {
  enabled?: boolean;
};

export const announcementsForUserOptions = (
  searchParams?: AnnouncementFilters,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: ["announcements-for-user", searchParams],
  queryFn: async () => {
    const response = await ApiClient.api.announcementsControllerGetAnnouncementsForUser({
      ...(searchParams?.title && { title: searchParams.title }),
      ...(searchParams?.content && { content: searchParams.content }),
      ...(searchParams?.authorName && { authorName: searchParams.authorName }),
      ...(searchParams?.search && { search: searchParams.search }),
      ...(searchParams?.isRead && { isRead: searchParams.isRead }),
    });
    return response.data;
  },
  select: (data: GetAnnouncementsForUserResponse) => data.data,
  ...options,
});

export function useAnnouncementsForUser(searchParams?: AnnouncementFilters) {
  return useQuery(announcementsForUserOptions(searchParams));
}

export function useAnnouncementsForUserSuspense(searchParams?: AnnouncementFilters) {
  return useSuspenseQuery(announcementsForUserOptions(searchParams));
}
