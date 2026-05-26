import { useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { GetAllAnnouncementsResponse } from "./../../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const ALL_ANNOUNCEMENTS_QUERY_KEY = "announcements";

export type AllAnnouncementsParams = {
  language?: SupportedLanguages;
  page?: number;
  perPage?: number;
};

type QueryOptions = {
  enabled?: boolean;
};

export const allAnnouncementsOptions = (
  searchParams?: AllAnnouncementsParams,
  options: QueryOptions = { enabled: true },
) => ({
  queryKey: [ALL_ANNOUNCEMENTS_QUERY_KEY, searchParams],
  queryFn: async () => {
    const { data } = await ApiClient.api.announcementsControllerGetAllAnnouncements({
      ...(searchParams?.language && { language: searchParams.language }),
      ...(searchParams?.page && { page: searchParams.page }),
      ...(searchParams?.perPage && { perPage: searchParams.perPage }),
    });

    return data;
  },
  select: (data: GetAllAnnouncementsResponse) => data.data,
  ...options,
});

export function useAllAnnouncements(searchParams?: AllAnnouncementsParams, options?: QueryOptions) {
  return useQuery(allAnnouncementsOptions(searchParams, options));
}

export function useAllAnnouncementsSuspense() {
  return useSuspenseQuery(allAnnouncementsOptions());
}
