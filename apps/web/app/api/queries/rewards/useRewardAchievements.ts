import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { ApiData, RewardAchievement } from "./types";

export const rewardAchievementsQueryKey = ["rewards", "achievements"] as const;

export function useRewardAchievements() {
  return useQuery({
    queryKey: rewardAchievementsQueryKey,
    queryFn: async () => {
      const response = await ApiClient.instance.get<ApiData<RewardAchievement[]>>(
        "/api/rewards/achievements",
        { params: { includeArchived: true } },
      );

      return response.data.data;
    },
  });
}
