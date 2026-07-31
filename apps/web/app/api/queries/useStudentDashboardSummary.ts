import { useQuery } from "@tanstack/react-query";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ApiClient } from "../api-client";

export const studentDashboardSummaryQueryOptions = (language: string) => ({
  queryKey: ["dashboard", "studentCourseSummary", language],
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetStudentDashboardSummary({
      language: language as "en" | "pl" | "de" | "lt" | "cs" | "es",
    });
    return response.data.data;
  },
});

export function useStudentDashboardSummary() {
  const language = useLanguageStore((state) => state.language);

  return useQuery(studentDashboardSummaryQueryOptions(language));
}
