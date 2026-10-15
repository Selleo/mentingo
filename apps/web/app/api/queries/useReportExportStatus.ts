import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export function useReportExportStatus(id?: string) {
  return useQuery({
    queryKey: ["reports", "export", id],
    enabled: Boolean(id),
    queryFn: async () => {
      const response = await ApiClient.api.reportControllerGetReportExport(id ?? "");
      return response.data.data;
    },
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "completed" || status === "failed" ? false : 1500;
    },
  });
}
