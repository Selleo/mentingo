import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

type LiveTrainingQueryOptions = {
  enabled?: boolean;
  retry?: boolean;
};

export const LIVE_TRAINING_QUERY_KEY = ["live-training"];

export const liveTrainingQueryOptions = (
  id: string | undefined,
  language?: SupportedLanguages,
  options: LiveTrainingQueryOptions = { enabled: true },
) =>
  queryOptions({
    queryKey: [...LIVE_TRAINING_QUERY_KEY, id, language],
    queryFn: async () => {
      if (!id) {
        throw new Error("liveTrainingView.errors.idRequired");
      }

      const response = await ApiClient.api.liveTrainingControllerGetLiveTraining(id, {
        language: language ?? SUPPORTED_LANGUAGES.EN,
      });

      return response.data.data;
    },
    ...options,
  });

export function useLiveTraining(
  id: string | undefined,
  language?: SupportedLanguages,
  options?: LiveTrainingQueryOptions,
) {
  return useQuery(liveTrainingQueryOptions(id, language, options));
}
