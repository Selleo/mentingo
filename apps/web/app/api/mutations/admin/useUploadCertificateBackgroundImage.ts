import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { globalSettingsQueryOptions } from "~/api/queries/useGlobalSettings";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

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

      toast({ description: t("uploadFile.toast.fileUploadedSuccessfully") });
    },
    onError: (error) => {
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
