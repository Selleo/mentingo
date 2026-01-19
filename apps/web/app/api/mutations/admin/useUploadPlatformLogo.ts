import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";
import { platformLogoQueryOptions } from "~/hooks/usePlatformLogo";

import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

interface UploadPlatformLogoOptions {
  logo?: File | null;
}

export function useUploadPlatformLogo() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ logo }: UploadPlatformLogoOptions) => {
      const response = await ApiClient.api.settingsControllerUpdatePlatformLogo({ logo });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(platformLogoQueryOptions(t));
      toast({ description: t("platformLogo.toast.logoUploadedSuccessfully") });
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
