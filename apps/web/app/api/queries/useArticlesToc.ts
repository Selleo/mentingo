import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";
import type { GetArticleTocResponse } from "~/api/generated-api";

export const ARTICLES_TOC_QUERY_KEY = ["articlesToc"];

export const articlesTocQueryOptions = (language?: SupportedLanguages, isDraftMode?: boolean) =>
  queryOptions({
    enabled: !!language,
    queryKey: [ARTICLES_TOC_QUERY_KEY, { language, isDraftMode }],
    queryFn: async () => {
      const response = await ApiClient.api.articlesControllerGetArticleToc({
        language,
        isDraftMode,
      });

      return response.data;
    },
    select: (data: GetArticleTocResponse) => data.data.sections,
  });

export function useArticlesToc(language?: SupportedLanguages, isDraftMode?: boolean) {
  return useQuery(articlesTocQueryOptions(language, isDraftMode));
}

export function useArticlesTocSuspense(language?: SupportedLanguages, isDraftMode?: boolean) {
  return useSuspenseQuery(articlesTocQueryOptions(language, isDraftMode));
}
