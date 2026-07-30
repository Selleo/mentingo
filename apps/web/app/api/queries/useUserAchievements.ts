import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetUserAchievementsResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const USER_ACHIEVEMENTS_QUERY_KEY = ["user-achievements"] as const;

export const userAchievementsQueryOptions = (userId?: string, language?: SupportedLanguages) =>
  queryOptions({
    queryKey: [...USER_ACHIEVEMENTS_QUERY_KEY, { userId, language }],
    queryFn: async () => {
      const response = await ApiClient.api.achievementsControllerGetUserAchievements({
        userId,
        language,
      });
      return response.data;
    },
    select: (data: GetUserAchievementsResponse) => data.data,
  });

export function useUserAchievements(userId?: string, language?: SupportedLanguages) {
  return useQuery(userAchievementsQueryOptions(userId, language));
}

export function useUserAchievementsSuspense(userId?: string, language?: SupportedLanguages) {
  return useSuspenseQuery(userAchievementsQueryOptions(userId, language));
}
