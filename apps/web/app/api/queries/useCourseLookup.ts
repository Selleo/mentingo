import { queryOptions } from "@tanstack/react-query";

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
      const response = await ApiClient.api.courseControllerLookupCourse({
        id: idOrSlug,
        language,
      });

      return response.data.data;
    },
  });
