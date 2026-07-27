import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const AI_JUDGE_CONFIGURATION_GENERATION_QUERY_KEY = [
  "ai-judge-configuration-generation",
] as const;

export const aiJudgeConfigurationGenerationSnapshotQueryOptions = (generationId?: string) =>
  queryOptions({
    enabled: Boolean(generationId),
    queryKey: [...AI_JUDGE_CONFIGURATION_GENERATION_QUERY_KEY, generationId],
    queryFn: async () => {
      if (!generationId) throw new Error("AI Judge generation ID is required");

      const response =
        await ApiClient.api.aiJudgeConfigurationGenerationControllerGetGeneration(generationId);

      return response.data.data;
    },
  });

export const useAiJudgeConfigurationGenerationSnapshot = (generationId?: string) =>
  useQuery(aiJudgeConfigurationGenerationSnapshotQueryOptions(generationId));
