import { useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

export const COURSE_TRANSLATIONS_QUERY_KEY = ["missing-translations"];

export const missingTranslationsQueryOptions = (
  courseId: string,
  language: SupportedLanguages,
) => ({
  queryKey: [COURSE_TRANSLATIONS_QUERY_KEY, { id: courseId, language }],
  queryFn: async () => {
    const { data } = await ApiClient.api.courseControllerHasMissingTranslations({
      id: courseId,
      language,
    });

    return data;
  },
});

export function useMissingTranslations(courseId: string, language: SupportedLanguages) {
  return useSuspenseQuery(missingTranslationsQueryOptions(courseId, language));
}
