import { keepPreviousData, queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../../api-client";

import type { SupportedLanguages } from "@repo/shared";

export const ADMIN_ACHIEVEMENTS_QUERY_KEY = ["gamification", "admin", "achievements"] as const;

export const adminAchievementsQueryOptions = (language: SupportedLanguages) =>
  queryOptions({
    queryKey: [...ADMIN_ACHIEVEMENTS_QUERY_KEY, { language }],
    queryFn: async () => {
      const response = await ApiClient.api.achievementAdminControllerGetAdminAchievements({
        language,
      });

      return response.data.data;
    },
  });

export const adminAchievementQueryOptions = (id: string, language: SupportedLanguages) =>
  queryOptions({
    queryKey: [...ADMIN_ACHIEVEMENTS_QUERY_KEY, id, { language }],
    queryFn: async () => {
      const response = await ApiClient.api.achievementAdminControllerGetAdminAchievement(id, {
        language,
      });

      return response.data.data;
    },
  });

export function useAdminAchievements(language: SupportedLanguages) {
  return useQuery(adminAchievementsQueryOptions(language));
}

export function useAdminAchievement(id: string | undefined, language: SupportedLanguages) {
  return useQuery({
    ...adminAchievementQueryOptions(id ?? "", language),
    enabled: Boolean(id),
    // Keeps the edit form mounted while the UI language changes.
    placeholderData: keepPreviousData,
  });
}
