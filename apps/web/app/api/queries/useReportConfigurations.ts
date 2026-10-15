import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const REPORT_CONFIGURATIONS_QUERY_KEY = ["reports", "configurations"];

export function useReportConfigurations() {
  return useQuery({
    queryKey: REPORT_CONFIGURATIONS_QUERY_KEY,
    queryFn: async () => {
      const response = await ApiClient.api.reportControllerListReportConfigurations();
      return response.data.data;
    },
  });
}
