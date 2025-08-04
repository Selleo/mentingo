import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

export function useDeleteFile() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (fileKey: string) => {
      return await ApiClient.api.fileControllerDeleteFile({
        fileKey,
      });
    },
    onSuccess: () => {
      toast({ description: t("deleteFile.toast.success") });
    },
    onError: (error) => {
      toast({
        description: error.message,
        variant: "destructive",
      });
    },
  });
}
