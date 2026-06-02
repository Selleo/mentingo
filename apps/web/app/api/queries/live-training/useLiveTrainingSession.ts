import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

type LiveTrainingSessionQueryOptions = {
  enabled?: boolean;
};

export const LIVE_TRAINING_SESSION_QUERY_KEY = ["live-training-session"];

export const liveTrainingSessionQueryOptions = (
  liveTrainingId: string,
  sessionId: string,
  language?: SupportedLanguages,
  options: LiveTrainingSessionQueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [...LIVE_TRAINING_SESSION_QUERY_KEY, liveTrainingId, sessionId, language],
    queryFn: async () => {
      const response = await ApiClient.api.liveTrainingSessionsControllerGetSession(
        liveTrainingId,
        sessionId,
        { language: language ?? SUPPORTED_LANGUAGES.EN },
      );

      return response.data.data;
    },
    ...options,
  });

export function useLiveTrainingSession(
  liveTrainingId: string,
  sessionId: string,
  language?: SupportedLanguages,
  options?: LiveTrainingSessionQueryOptions,
) {
  return useQuery(liveTrainingSessionQueryOptions(liveTrainingId, sessionId, language, options));
}
