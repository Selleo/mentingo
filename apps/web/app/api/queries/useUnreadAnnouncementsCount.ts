import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetUnreadAnnouncementsCountResponse } from "../generated-api";

export const UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY = "unread-announcements-count";

type QueryOptions = {
  enabled?: boolean;
};

export const unreadAnnouncementsCountOptions = (options: QueryOptions = { enabled: true }) => ({
  queryKey: [UNREAD_ANNOUNCEMENTS_COUNT_QUERY_KEY],
  queryFn: async () => {
    const { data } = await ApiClient.api.announcementsControllerGetUnreadAnnouncementsCount();

    return data;
  },
  select: (data: GetUnreadAnnouncementsCountResponse) => data.data,
  ...options,
});

export function useUnreadAnnouncementsCount(options?: QueryOptions) {
  return useQuery(unreadAnnouncementsCountOptions(options));
}
