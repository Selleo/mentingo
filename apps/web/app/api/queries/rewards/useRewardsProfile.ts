import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { ApiData, RewardsProfile } from "./types";

export const rewardsProfileQueryKey = (userId: string) => ["rewards", "profile", userId] as const;

export function useRewardsProfile(userId: string, enabled = true) {
  return useQuery({
    queryKey: rewardsProfileQueryKey(userId),
    queryFn: async () => {
      const response = await ApiClient.instance.get<ApiData<RewardsProfile>>(
        `/api/rewards/profile/${userId}`,
      );

      return response.data.data;
    },
    enabled: enabled && Boolean(userId),
  });
}
