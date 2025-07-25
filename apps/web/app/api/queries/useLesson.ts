import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetLessonByIdResponse } from "../generated-api";
import type { Language } from "~/modules/Dashboard/Settings/Language/LanguageStore";

export const lessonQueryOptions = (id: string, userLanguage?: Language) =>
  queryOptions({
    queryKey: ["lesson", id],
    queryFn: async () => {
      const response = await ApiClient.api.lessonControllerGetLessonById(id, { userLanguage });
      return response.data;
    },
    select: (data: GetLessonByIdResponse) => data.data,
  });

export function useLesson(id: string, userLanguage?: Language) {
  return useQuery(lessonQueryOptions(id, userLanguage));
}

export function useLessonSuspense(id: string, userLanguage?: Language) {
  return useSuspenseQuery(lessonQueryOptions(id, userLanguage));
}
