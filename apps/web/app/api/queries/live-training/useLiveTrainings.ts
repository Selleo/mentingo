import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { LIVE_TRAINING_QUERY_KEY } from "~/api/queries/live-training/useLiveTraining";

import type { LiveTrainingStatus, SupportedLanguages } from "@repo/shared";

type LiveTrainingsQueryOptions = {
  enabled?: boolean;
  status?: LiveTrainingStatus;
  language?: SupportedLanguages;
  page?: number;
  perPage?: number;
};

export const liveTrainingsQueryOptions = ({
  enabled = true,
  status,
  language = SUPPORTED_LANGUAGES.EN,
  page = 1,
  perPage = 50,
}: LiveTrainingsQueryOptions = {}) =>
  queryOptions({
    queryKey: [...LIVE_TRAINING_QUERY_KEY, "list", { status, language, page, perPage }],
    queryFn: async () => {
      const response = await ApiClient.api.liveTrainingControllerGetLiveTrainings({
        status,
        language,
        page,
        perPage,
      });

      return response.data.data;
    },
    enabled,
  });

export function useLiveTrainings(options?: LiveTrainingsQueryOptions) {
  return useQuery(liveTrainingsQueryOptions(options));
}
