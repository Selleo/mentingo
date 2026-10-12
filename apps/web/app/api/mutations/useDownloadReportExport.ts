import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { toast } from "~/components/ui/use-toast";
import { triggerBrowserDownload } from "~/utils/downloadFile";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

export function useDownloadReportExport() {
  const { t } = useTranslation();
  return useMutation({
    mutationFn: async (input: { id: string; fileName: string }) => {
      const response = await ApiClient.api.reportControllerDownloadReportExport(input.id, {
        format: "blob",
      });
      triggerBrowserDownload(response.data as unknown as Blob, input.fileName);
    },
    onError: (error) =>
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("reports.errors.exportUnavailable")),
        variant: "destructive",
      }),
  });
}
