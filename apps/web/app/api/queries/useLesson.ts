import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetLessonByIdResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const lessonQueryOptions = (id: string, language?: SupportedLanguages, studentId?: string) =>
  queryOptions({
    enabled: !!id && !!language,
    queryKey: ["lesson", id, language, studentId ? studentId : null],
    queryFn: async () => {
      const response = await ApiClient.api.lessonControllerGetLessonById(id, {
        language,
        studentId: studentId || "",
      });
      return response.data;
    },
    select: (data: GetLessonByIdResponse) => data.data,
  });

export function useLesson(id: string, language?: SupportedLanguages, studentId?: string) {
  return useQuery(lessonQueryOptions(id, language, studentId));
}

export function useLessonSuspense(id: string, language?: SupportedLanguages, studentId?: string) {
  return useSuspenseQuery(lessonQueryOptions(id, language, studentId));
}
