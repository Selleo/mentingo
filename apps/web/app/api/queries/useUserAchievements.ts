import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetUserAchievementsResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const USER_ACHIEVEMENTS_QUERY_KEY = ["user-achievements"] as const;

export const userAchievementsQueryOptions = (language?: SupportedLanguages) =>
  queryOptions({
    queryKey: [...USER_ACHIEVEMENTS_QUERY_KEY, { language }],
    queryFn: async () => {
      const response = await ApiClient.api.achievementsControllerGetUserAchievements({
        language,
      });
      return response.data;
    },
    select: (data: GetUserAchievementsResponse) => data.data,
  });

export function useUserAchievements(language?: SupportedLanguages) {
  return useQuery(userAchievementsQueryOptions(language));
}

export function useUserAchievementsSuspense(language?: SupportedLanguages) {
  return useSuspenseQuery(userAchievementsQueryOptions(language));
}
