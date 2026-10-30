import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";
import {
  extractFilenameFromContentDisposition,
  triggerBrowserDownload,
} from "~/utils/downloadFile";

import { ApiClient } from "../api-client";
import { getTranslatedApiErrorMessage } from "../utils/getTranslatedApiErrorMessage";

export function useDownloadCompetenciesAttachment() {
  const { t } = useTranslation();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) =>
      ApiClient.api.competenciesControllerDownloadCompetenciesAttachment(id, { format: "blob" }),
    onSuccess: (response) =>
      triggerBrowserDownload(
        response.data as unknown as Blob,
        extractFilenameFromContentDisposition(response.headers["content-disposition"]) ??
          "evidence",
      ),
    onError: (error) =>
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(
          error,
          t,
          t("competencies.notifications.attachmentDownloadFailed"),
          {
            allowUntranslatedMessage: false,
          },
        ),
      }),
  });
}
