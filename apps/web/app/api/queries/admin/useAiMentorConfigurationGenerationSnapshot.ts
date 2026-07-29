import { AI_MENTOR_CONFIGURATION_GENERATION_STATUS } from "@repo/shared";
import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

export const AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY = [
  "ai-mentor-configuration-generation",
] as const;

const isActiveGenerationStatus = (status?: string) =>
  status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.DRAFTING ||
  status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.EVALUATING ||
  status === AI_MENTOR_CONFIGURATION_GENERATION_STATUS.REVISING;

export const useAiMentorConfigurationGenerationSnapshot = (generationId?: string) =>
  useQuery({
    queryKey: [...AI_MENTOR_CONFIGURATION_GENERATION_QUERY_KEY, generationId],
    enabled: Boolean(generationId),
    queryFn: async () => {
      if (!generationId) throw new Error("AI Mentor generation ID is required");

      return (
        await ApiClient.api.aiMentorConfigurationGenerationControllerGetAiMentorConfigurationGeneration(
          generationId,
        )
      ).data.data;
    },
    refetchInterval: (query) =>
      isActiveGenerationStatus(query.state.data?.progress.status) ? 2000 : false,
  });
