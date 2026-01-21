import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

interface UseUploadCertificateBackgroundImageOptions {
  certificateBackgroundImage?: File;
}

export function useUploadCertificateBackgroundImage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({
      certificateBackgroundImage,
    }: UseUploadCertificateBackgroundImageOptions) => {
      const response = await ApiClient.api.settingsControllerUpdateCertificateBackground({
        "certificate-background": certificateBackgroundImage,
      });

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(globalSettingsQueryOptions);

      toast({ description: t("certificateBackgroundUpload.toast.success") });
    },
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as ApiErrorResponse;

      toast({
        description: t(apiResponseData.message),
        variant: "destructive",
      });
    },
  });
}
