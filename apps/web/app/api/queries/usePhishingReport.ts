import { useQuery } from "@tanstack/react-query";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ApiClient } from "../api-client";
export function usePhishingReport(id: string, enabled = true) {
  const language = useLanguageStore((state) => state.language);
  return useQuery({
    queryKey: ["phishing", "report", id, language],
    queryFn: async () =>
      (await ApiClient.api.phishingControllerGetPhishingReport(id, { language })).data.data,
    enabled,
    staleTime: 10000,
  });
}
