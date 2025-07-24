import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../api-client";
import { queryClient } from "../queryClient";

interface UploadPlatformLogoOptions {
  logo: File;
}

export function useUploadPlatformLogo() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ logo }: UploadPlatformLogoOptions) => {
      const formData = new FormData();
      formData.append("logo", logo);

      const response = await ApiClient.instance.patch("/api/settings/platform-logo", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["platform-logo"] });
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
