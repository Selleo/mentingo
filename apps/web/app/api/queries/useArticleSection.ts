import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export const ARTICLE_SECTION_QUERY_KEY = ["articleSection"];

export const articleSectionQueryOptions = (sectionId: string, language?: SupportedLanguages) =>
  queryOptions({
    enabled: !!sectionId && !!language,
    queryKey: [ARTICLE_SECTION_QUERY_KEY, { sectionId, language }],
    queryFn: async () => {
      const response = await ApiClient.api.articlesControllerGetArticleSection(sectionId, {
        language,
      });

      return response.data;
    },
    select: (data) => data.data,
  });

export function useArticleSection(sectionId: string, language?: SupportedLanguages) {
  return useQuery(articleSectionQueryOptions(sectionId, language));
}
