import { useQuery } from "@tanstack/react-query";

import { ApiClient } from "../api-client";

export const auditBenchmarkQueryKey = ["audit", "benchmark"] as const;

export function useAuditBenchmark() {
  return useQuery({
    queryKey: auditBenchmarkQueryKey,
    queryFn: async () => {
      const response = await ApiClient.api.auditControllerGetBenchmark();
      return response.data.data;
    },
  });
}
