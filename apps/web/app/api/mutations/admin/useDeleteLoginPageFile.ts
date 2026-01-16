import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { LOGIN_PAGE_FILES_QUERY_KEY } from "~/api/queries/useLoginPageFiles";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { AxiosError } from "axios";

export type DeleteLoginPageFileOptions = {
  id: string;
};

export default function useDeleteLoginPageFile() {
  const { t } = useTranslation();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async ({ id }: DeleteLoginPageFileOptions) => {
      const response = await ApiClient.api.settingsControllerDeleteLoginPageFile(id);

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LOGIN_PAGE_FILES_QUERY_KEY });

      toast({ description: t("loginFilesUpload.toast.successfullyDeletedFile") });
    },
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as { message: string };
      toast({
        description: t(apiResponseData.message),
        variant: "destructive",
      });
    },
  });
}
