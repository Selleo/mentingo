import { useQuery } from "@tanstack/react-query";

import { useLanguageStore } from "~/modules/Dashboard/Settings/Language/LanguageStore";

import { ApiClient } from "../api-client";

import type { SupportedLanguages } from "@repo/shared";

export const studentDashboardSummaryQueryOptions = (language: SupportedLanguages) => ({
  queryKey: ["dashboard", "studentCourseSummary", language],
  queryFn: async () => {
    const response = await ApiClient.api.courseControllerGetStudentDashboardSummary({
      language,
    });
    return response.data.data;
  },
});

export function useStudentDashboardSummary() {
  const language = useLanguageStore((state) => state.language);

  return useQuery(studentDashboardSummaryQueryOptions(language));
}
