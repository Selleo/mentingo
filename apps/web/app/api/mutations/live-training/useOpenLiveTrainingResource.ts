import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";
import { triggerBrowserDownload } from "~/utils/downloadFile";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";

type OpenLiveTrainingResourceOptions = {
  liveTrainingId: string;
  resourceId: string;
  language: SupportedLanguages;
  filename: string;
};

export function useOpenLiveTrainingResource() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      liveTrainingId,
      resourceId,
      language,
      filename,
    }: OpenLiveTrainingResourceOptions) => {
      const response = await ApiClient.api.liveTrainingControllerGetLiveTrainingResourceDownloadUrl(
        liveTrainingId,
        resourceId,
        { language },
      );
      const fileResponse = await fetch(response.data.data.url);

      if (!fileResponse.ok) {
        throw new Error("Failed to download file");
      }

      return { blob: await fileResponse.blob(), filename };
    },
    onSuccess: ({ blob, filename }) => {
      triggerBrowserDownload(blob, filename);
    },
    onError: (error: AxiosError) => {
      toast({
        variant: "destructive",
        description: getTranslatedApiErrorMessage(error, t, t("common.toast.somethingWentWrong")),
      });
    },
  });
}
