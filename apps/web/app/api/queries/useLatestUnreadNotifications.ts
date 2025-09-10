import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetLatestUnreadAnnouncementsResponse } from "../generated-api";

export const latestUnreadAnnouncementsOptions = () => ({
  queryKey: ["latest-unread-announcements"],
  queryFn: async () => {
    const response = await ApiClient.api.announcementsControllerGetLatestUnreadAnnouncements();
    return response.data;
  },
  select: (data: GetLatestUnreadAnnouncementsResponse) => data.data,
});

export function useLatestUnreadAnnouncements() {
  return useQuery(latestUnreadAnnouncementsOptions());
}

export function useLatestUnreadAnnouncementsSuspense() {
  return useSuspenseQuery(latestUnreadAnnouncementsOptions());
}
