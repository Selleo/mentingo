import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { ApiData, RewardRule } from "./types";

export const rewardRulesQueryKey = ["rewards", "rules"] as const;

export function useRewardRules() {
  return useQuery({
    queryKey: rewardRulesQueryKey,
    queryFn: async () => {
      const response = await ApiClient.instance.get<ApiData<RewardRule[]>>("/api/rewards/rules");

      return response.data.data;
    },
  });
}
