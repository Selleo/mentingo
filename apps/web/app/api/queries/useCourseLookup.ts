import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export const getCourseLookupQueryKey = (idOrSlug: string, language: SupportedLanguages) => [
  "courseLookup",
  { idOrSlug, language },
];

export const courseLookupQueryOptions = (idOrSlug: string, language: SupportedLanguages) =>
  queryOptions({
    queryKey: getCourseLookupQueryKey(idOrSlug, language),
    queryFn: async () => {
      try {
        const response = await ApiClient.api.courseControllerLookupCourse({
          id: idOrSlug,
          language,
        });

        return response.data.data;
      } catch (error) {
        if (isAxiosError(error) && error.response?.status === 404) return null;
        throw error;
      }
    },
  });

export function useCourseLookupSuspense(idOrSlug: string, language: SupportedLanguages) {
  return useSuspenseQuery(courseLookupQueryOptions(idOrSlug, language));
}
