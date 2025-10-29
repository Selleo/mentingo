import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetLessonByIdResponse } from "../generated-api";
import type { Language } from "~/modules/Dashboard/Settings/Language/LanguageStore";

export const lessonQueryOptions = (id: string, userLanguage?: Language, studentId?: string) =>
  queryOptions({
    queryKey: ["lesson", id, userLanguage, studentId ? studentId : null],
    queryFn: async () => {
      const response = await ApiClient.api.lessonControllerGetLessonById(id, {
        userLanguage: userLanguage || "",
        studentId: studentId || "",
      });
      return response.data;
    },
    select: (data: GetLessonByIdResponse) => data.data,
  });

export function useLesson(id: string, userLanguage?: Language, studentId?: string) {
  return useQuery(lessonQueryOptions(id, userLanguage, studentId));
}

export function useLessonSuspense(id: string, userLanguage?: Language, studentId?: string) {
  return useSuspenseQuery(lessonQueryOptions(id, userLanguage, studentId));
}
