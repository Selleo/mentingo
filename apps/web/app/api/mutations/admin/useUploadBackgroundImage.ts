import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";
import { loginBackgroundQueryOptions } from "~/hooks/useLoginBackground";

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
      toast({ description: t("backgroundImage.toast.backgroundImageUploadedSuccessfully") });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          description: error.response?.data.message,
          variant: "destructive",
        });
      }

      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
