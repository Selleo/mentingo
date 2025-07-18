import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { Language } from "~/modules/Dashboard/Settings/Language/LanguageStore";

export const currentThreadQueryOptions = (lessonId: string, userLanguage: Language) =>
  queryOptions({
    queryKey: ["thread", { lessonId }],
    queryFn: async () => {
      const response = await ApiClient.api.aiControllerCreateThread({ lessonId, userLanguage });
      return response.data;
    },
  });

export function useCurrentThread(lessonId: string, userLanguage: Language) {
  return useQuery(currentThreadQueryOptions(lessonId, userLanguage));
}
export function useSuspenseCurrentThread(lessonId: string, userLanguage: Language) {
  return useSuspenseQuery(currentThreadQueryOptions(lessonId, userLanguage));
}
