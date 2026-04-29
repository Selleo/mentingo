import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { FindMineResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export type ProfileAchievementsResponse = FindMineResponse["data"];
export type ProfileAchievement = ProfileAchievementsResponse["achievements"][number];

export const profileAchievementsQueryOptions = (language: SupportedLanguages) => ({
  queryKey: ["profile-achievements", language] as const,
  queryFn: async () => {
    const response = await ApiClient.api.profileAchievementsControllerFindMine({ language });

    return response.data.data;
  },
});

export function useProfileAchievements(language: SupportedLanguages, enabled: boolean) {
  return useQuery({
    ...profileAchievementsQueryOptions(language),
    enabled,
  });
}
