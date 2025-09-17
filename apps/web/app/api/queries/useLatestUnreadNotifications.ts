import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetLatestUnreadAnnouncementsResponse } from "../generated-api";

export const latestUnreadAnnouncementsOptions = (isAuthenticated: boolean) => ({
  queryKey: ["latest-unread-announcements"],
  queryFn: async () => {
    const response = await ApiClient.api.announcementsControllerGetLatestUnreadAnnouncements();
    return response.data;
  },
  select: (data: GetLatestUnreadAnnouncementsResponse) => data.data,
  enabled: isAuthenticated,
});

export function useLatestUnreadAnnouncements(isAuthenticated: boolean) {
  return useQuery(latestUnreadAnnouncementsOptions(isAuthenticated));
}

export function useLatestUnreadAnnouncementsSuspense(isAuthenticated: boolean) {
  return useSuspenseQuery(latestUnreadAnnouncementsOptions(isAuthenticated));
}
