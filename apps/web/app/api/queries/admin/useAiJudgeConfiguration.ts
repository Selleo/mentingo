import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";
import type { GetConfigurationResponse } from "~/api/generated-api";

export const AI_JUDGE_CONFIGURATION_QUERY_KEY = ["ai-judge-configuration"] as const;

export const aiJudgeConfigurationQueryOptions = (lessonId: string, language: SupportedLanguages) =>
  queryOptions({
    enabled: Boolean(lessonId),
    queryKey: [...AI_JUDGE_CONFIGURATION_QUERY_KEY, lessonId, language],
    queryFn: async () => {
      const response = await ApiClient.api.aiJudgeConfigurationControllerGetConfiguration(
        lessonId,
        { language },
      );
      return response.data;
    },
    select: (response: GetConfigurationResponse) => response.data,
  });

export const useAiJudgeConfiguration = (lessonId: string, language: SupportedLanguages) =>
  useQuery(aiJudgeConfigurationQueryOptions(lessonId, language));
