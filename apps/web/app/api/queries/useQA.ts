import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";

import type { SupportedLanguages } from "@repo/shared";

export const QA_QUERY_KEY = ["QA"];

export const QAQueryOptions = (id: string, language: SupportedLanguages) =>
  queryOptions({
    queryKey: [QA_QUERY_KEY, { id }, { language }],
    queryFn: async () => {
      const response = await ApiClient.api.qaControllerGetQa(id, { language });

      return response.data;
    },
  });

export default function useQA(id: string, language: SupportedLanguages) {
  return useQuery(QAQueryOptions(id, language));
}
