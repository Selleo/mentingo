import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";
import type { GetAiMentorConfigurationResponse } from "~/api/generated-api";

export const AI_MENTOR_CONFIGURATION_QUERY_KEY = ["ai-mentor-configuration"] as const;

export const aiMentorConfigurationQueryOptions = (lessonId: string, language: SupportedLanguages) =>
  queryOptions({
    enabled: Boolean(lessonId),
    queryKey: [...AI_MENTOR_CONFIGURATION_QUERY_KEY, lessonId, language],
    queryFn: async () => {
      const response = await ApiClient.api.aiMentorConfigurationControllerGetAiMentorConfiguration(
        lessonId,
        {
          language,
        },
      );
      return response.data;
    },
    select: (response: GetAiMentorConfigurationResponse) => response.data,
  });

export const useAiMentorConfiguration = (lessonId: string, language: SupportedLanguages) =>
  useQuery(aiMentorConfigurationQueryOptions(lessonId, language));
