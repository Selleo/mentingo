import { useQuery } from "@tanstack/react-query";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ApiClient } from "../api-client";

export function useCertificateDashboardSummary() {
  const language = useLanguageStore((state) => state.language);

  return useQuery({
    queryKey: ["dashboard", "certificateSummary", language],
    queryFn: async () => {
      const response = await ApiClient.api.certificatesControllerGetDashboardSummary({
        language,
      });
      return response.data.data;
    },
  });
}
