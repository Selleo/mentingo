import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetAllAnnouncementsResponse } from "./../../generated-api";

export const allAnnouncementsOptions = () => ({
  queryKey: ["announcements"],
  queryFn: async () => {
    const response = await ApiClient.api.announcementsControllerGetAllAnnouncements();
    return response.data;
  },
  select: (data: GetAllAnnouncementsResponse) => data.data,
});

export function useAllAnnouncements() {
  return useQuery(allAnnouncementsOptions());
}

export function useAllAnnouncementsSuspense() {
  return useSuspenseQuery(allAnnouncementsOptions());
}
