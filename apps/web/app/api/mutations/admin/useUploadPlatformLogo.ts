import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";
import { platformLogoQueryOptions } from "~/hooks/usePlatformLogo";

interface UploadPlatformLogoOptions {
  logo: File;
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
