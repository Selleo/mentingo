import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { toast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import type { SupportedLanguages } from "@repo/shared";
import type { ReportsQuery } from "~/modules/Reports/reports-api.types";

export function useCreateReportExport() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: {
      format: "xlsx" | "pdf";
      language: SupportedLanguages;
      query: ReportsQuery;
    }) => {
      const response = await ApiClient.api.reportControllerCreateReportExport(input);
      return response.data.data;
    },
    onError: (error) =>
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("reports.exports.failed")),
        variant: "destructive",
      }),
  });
}
