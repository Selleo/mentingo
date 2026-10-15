import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export const REPORT_OPTIONS_QUERY_KEY = ["reports", "options"];

export function useReportOptions(language: SupportedLanguages, search: string) {
  return useQuery({
    queryKey: [...REPORT_OPTIONS_QUERY_KEY, language, search],
    queryFn: async () => {
      const response = await ApiClient.api.reportControllerGetReportOptions({ language, search });
      return response.data.data;
    },
  });
}
