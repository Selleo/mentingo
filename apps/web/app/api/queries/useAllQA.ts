import { queryOptions, useQuery } from "@tanstack/react-query";

import { ApiClient } from "~/api/api-client";
import { QA_QUERY_KEY } from "~/api/queries/useQA";

import type { SupportedLanguages } from "@repo/shared";

export const allQAQueryOptions = (language: SupportedLanguages) =>
  queryOptions({
    queryKey: [QA_QUERY_KEY],
    queryFn: async () => {
      const response = await ApiClient.api.qaControllerGetAllQa({ language });

      return response.data;
    },
  });

export default function useAllQA(language: SupportedLanguages) {
  return useQuery(allQAQueryOptions(language));
}
