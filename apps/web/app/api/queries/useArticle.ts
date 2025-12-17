import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { GetArticleResponse } from "../generated-api";
import type { SupportedLanguages } from "@repo/shared";

export const ARTICLE_QUERY_KEY = "article";

export const articleQueryOptions = (
  id: string,
  language?: SupportedLanguages,
  isDraftMode?: boolean,
) =>
  queryOptions({
    enabled: !!id && !!language,
    queryKey: [ARTICLE_QUERY_KEY, { id, language, isDraftMode }],
    queryFn: async () => {
      const response = await ApiClient.api.articlesControllerGetArticle(id, {
        language,
        isDraftMode,
      });

      return response.data;
    },
    select: (data: GetArticleResponse) => data.data,
  });

export function useArticle(id: string, language?: SupportedLanguages, isDraftMode?: boolean) {
  return useQuery(articleQueryOptions(id, language, isDraftMode));
}

export function useArticleSuspense(
  id: string,
  language?: SupportedLanguages,
  isDraftMode?: boolean,
) {
  return useSuspenseQuery(articleQueryOptions(id, language, isDraftMode));
}
