import { useMutation } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { rewardAchievementsQueryKey } from "~/api/queries/rewards/useRewardAchievements";
import { rewardRulesQueryKey } from "~/api/queries/rewards/useRewardRules";
import { queryClient } from "~/api/queryClient";

import type { RewardActionType } from "@repo/shared";
import type { LocalizedText } from "~/api/queries/rewards/types";

type UpdateRuleInput = {
  actionType: RewardActionType;
  points: number;
  enabled: boolean;
};

export type UpsertAchievementInput = {
  id?: string;
  title: LocalizedText;
  description: LocalizedText;
  pointThreshold: number;
  sortOrder: number;
  iconResourceId?: string | null;
};

export function useUpdateRewardRule() {
  return useMutation({
    mutationFn: async ({ actionType, points, enabled }: UpdateRuleInput) => {
      const response = await ApiClient.instance.patch(`/api/rewards/rules/${actionType}`, {
        points,
        enabled,
      });

      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rewardRulesQueryKey }),
  });
}

export function useUpsertRewardAchievement() {
  return useMutation({
    mutationFn: async ({ id, ...body }: UpsertAchievementInput) => {
      const response = id
        ? await ApiClient.instance.patch(`/api/rewards/achievements/${id}`, body)
        : await ApiClient.instance.post("/api/rewards/achievements", body);

      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rewardAchievementsQueryKey }),
  });
}

export function useArchiveRewardAchievement() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await ApiClient.instance.patch(`/api/rewards/achievements/${id}/archive`);

      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: rewardAchievementsQueryKey }),
  });
}

export function useBackfillRewards() {
  return useMutation({
    mutationFn: async () => {
      const response = await ApiClient.instance.post("/api/rewards/backfill");

      return response.data;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rewards"] }),
  });
}
