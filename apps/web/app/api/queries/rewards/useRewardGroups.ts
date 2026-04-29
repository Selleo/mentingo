import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { ApiData, RewardGroup } from "./types";

export const rewardGroupsQueryKey = ["rewards", "groups"] as const;

export function useRewardGroups() {
  return useQuery({
    queryKey: rewardGroupsQueryKey,
    queryFn: async () => {
      const response = await ApiClient.instance.get<ApiData<RewardGroup[]>>("/api/rewards/groups");

      return response.data.data;
    },
  });
}
