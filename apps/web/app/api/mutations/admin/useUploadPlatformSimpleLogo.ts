import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { platformSimpleLogoQueryOptions } from "~/api/queries/usePlatformSimpleLogo";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

interface UploadPlatformSimpleLogoOptions {
  logo?: File | null;
}

export function useUploadPlatformSimpleLogo() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ logo }: UploadPlatformSimpleLogoOptions) => {
      const response = await ApiClient.api.settingsControllerUpdatePlatformSimpleLogo({
        logo,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(platformSimpleLogoQueryOptions());
      toast({ description: t("platformSimpleLogo.toast.logoUploadedSuccessfully") });
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
