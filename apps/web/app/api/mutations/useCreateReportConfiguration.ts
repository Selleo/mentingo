import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { toast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { REPORT_CONFIGURATIONS_QUERY_KEY } from "../queries/useReportConfigurations";
import { queryClient } from "../queryClient";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import type { CreateReportConfigurationBody } from "../generated-api";

export type CreateReportConfigurationInput = CreateReportConfigurationBody;

export function useCreateReportConfiguration() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: CreateReportConfigurationInput) => {
      const response = await ApiClient.api.reportControllerCreateReportConfiguration(input);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPORT_CONFIGURATIONS_QUERY_KEY });
      toast({ description: t("reports.saved.toastCreated") });
    },
    onError: (error) =>
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("reports.saved.toastError")),
        variant: "destructive",
      }),
  });
}
