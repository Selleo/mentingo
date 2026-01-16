import { SUPPORTED_LANGUAGES } from "@repo/shared";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetCourseResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const getCourseQueryKey = (id: string, language?: SupportedLanguages) => [
  "course",
  { id, ...(language ? { language } : {}) },
];

export const courseQueryOptions = (idOrSlug: string, language?: SupportedLanguages) =>
  queryOptions({
    queryKey: getCourseQueryKey(idOrSlug, language),
    queryFn: async () => {
      const response = await ApiClient.api.courseControllerGetCourse({
        id: idOrSlug ?? "",
        language,
      });
      return response.data;
    },
    select: (data: GetCourseResponse) => data.data,
  });

export function useCourse(idOrSlug: string, language: SupportedLanguages = SUPPORTED_LANGUAGES.EN) {
  return useQuery(courseQueryOptions(idOrSlug, language));
}

export function useCourseSuspense(
  idOrSlug: string,
  language: SupportedLanguages = SUPPORTED_LANGUAGES.EN,
) {
  return useSuspenseQuery(courseQueryOptions(idOrSlug, language));
}
