import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetAnnouncementsForUserResponse } from "../generated-api";

export const announcementsForUserOptions = () => ({
  queryKey: ["announcements-for-user"],
  queryFn: async () => {
    const response = await ApiClient.api.announcementsControllerGetAnnouncementsForUser();
    return response.data;
  },
  select: (data: GetAnnouncementsForUserResponse) => data.data,
});

export function useAnnouncementsForUser() {
  return useQuery(announcementsForUserOptions());
}

export function useAnnouncementsForUserSuspense() {
  return useSuspenseQuery(announcementsForUserOptions());
}
