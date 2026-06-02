import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

type LiveTrainingSessionsQueryOptions = {
  enabled?: boolean;
};

export const LIVE_TRAINING_SESSIONS_QUERY_KEY = ["live-training-sessions"];

export const liveTrainingSessionsQueryOptions = (
  liveTrainingId: string | undefined,
  language?: SupportedLanguages,
  options: LiveTrainingSessionsQueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [...LIVE_TRAINING_SESSIONS_QUERY_KEY, liveTrainingId, language],
    queryFn: async () => {
      if (!liveTrainingId) {
        throw new Error("liveTrainingView.errors.idRequired");
      }

      const response = await ApiClient.api.liveTrainingSessionsControllerGetSessions(
        liveTrainingId,
        { language: language ?? SUPPORTED_LANGUAGES.EN },
      );

      return response.data.data;
    },
    ...options,
  });

export function useLiveTrainingSessions(
  liveTrainingId: string | undefined,
  language?: SupportedLanguages,
  options?: LiveTrainingSessionsQueryOptions,
) {
  return useQuery(liveTrainingSessionsQueryOptions(liveTrainingId, language, options));
}
