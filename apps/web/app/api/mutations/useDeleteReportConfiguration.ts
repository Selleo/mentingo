import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { toast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { REPORT_CONFIGURATIONS_QUERY_KEY } from "../queries/useReportConfigurations";
import { queryClient } from "../queryClient";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

export function useDeleteReportConfiguration() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (id: string) => ApiClient.api.reportControllerDeleteReportConfiguration(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: REPORT_CONFIGURATIONS_QUERY_KEY });
      toast({ description: t("reports.saved.toastDeleted") });
    },
    onError: (error) =>
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("reports.saved.toastError")),
        variant: "destructive",
      }),
  });
}
