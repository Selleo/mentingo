import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

import type { ReportsQuery } from "~/modules/Reports/reports-api.types";

export const REPORT_RESULT_QUERY_KEY = ["reports", "result"];

export function useReportResult(query: ReportsQuery, enabled = true) {
  return useQuery({
    queryKey: [...REPORT_RESULT_QUERY_KEY, query],
    enabled,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const response = await ApiClient.api.reportControllerRunReport(query);
      return response.data.data;
    },
  });
}
