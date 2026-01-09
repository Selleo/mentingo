import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { LOGIN_PAGE_FILES_QUERY_KEY } from "~/api/queries/useLoginPageFiles";
import { queryClient } from "~/api/queryClient";
import { useToast } from "~/components/ui/use-toast";

import type { SupportedLanguages } from "@repo/shared";
import type { AxiosError } from "axios";
import type { UploadFilesToLoginPageValues } from "~/modules/Dashboard/Settings/components/admin/UploadFilesToLoginPage.schema";

type UpdateLoginFileOptions = UploadFilesToLoginPageValues & { language: SupportedLanguages };

export default function useUpdateLoginPageFiles() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (data: UpdateLoginFileOptions) => {
      const formData = new FormData();

      formData.append("file", data.file);

      if (data.id) {
        formData.append("id", data.id);
      }

      formData.append("name", data.name);

      const response = await ApiClient.api.settingsControllerUpdateLoginPageFiles(
        { ...data },
        {
          headers: { "Content-Type": "multipart/form-data" },
          transformRequest: () => formData,
        },
      );

      return response.data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: LOGIN_PAGE_FILES_QUERY_KEY });
      toast({ description: t("loginFilesUpload.toast.successfullyUploadedFile") });
    },
    onError: (error: AxiosError) => {
      const apiResponseData = error.response?.data as { message: string; count: number };
      toast({
        description: t(apiResponseData.message, { count: apiResponseData.count }),
        variant: "destructive",
      });
    },
  });
}
