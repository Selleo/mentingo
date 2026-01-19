import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";
import { loginBackgroundQueryOptions } from "~/hooks/useLoginBackground";

import type { AxiosError } from "axios";
import type { ApiErrorResponse } from "~/api/types";

interface UploadBackgroundImageOptions {
  backgroundImage: File | null;
}

export function useUploadBackgroundImage() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ backgroundImage }: UploadBackgroundImageOptions) => {
      const response = await ApiClient.api.settingsControllerUpdateLoginBackground({
        "login-background": backgroundImage,
      });

      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries(loginBackgroundQueryOptions(t));
      toast({ description: t("organizationLoginBackgroundImageUpload.toast.success") });
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
