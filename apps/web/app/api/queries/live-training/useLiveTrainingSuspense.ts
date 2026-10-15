import { useSuspenseQuery } from "@tanstack/react-query";

import { liveTrainingQueryOptions } from "./useLiveTraining";

import type { SupportedLanguages } from "@repo/shared";

export function useLiveTrainingSuspense(id: string, language: SupportedLanguages) {
  const query = useSuspenseQuery({
    ...liveTrainingQueryOptions(id, language),
    retry: false,
  });

  if (query.error && !query.isFetching) throw query.error;

  return query;
}
