import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { toast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { REPORT_CONFIGURATIONS_QUERY_KEY } from "../queries/useReportConfigurations";
import { queryClient } from "../queryClient";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

import type { UpdateReportConfigurationBody } from "../generated-api";

export type UpdateReportConfigurationInput = UpdateReportConfigurationBody & { id: string };

export function useUpdateReportConfiguration() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async ({ id, ...input }: UpdateReportConfigurationInput) => {
      const response = await ApiClient.api.reportControllerUpdateReportConfiguration(id, input);
      return response.data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPORT_CONFIGURATIONS_QUERY_KEY });
      toast({ description: t("reports.saved.toastUpdated") });
    },
    onError: (error) =>
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("reports.saved.toastError")),
        variant: "destructive",
      }),
  });
}
