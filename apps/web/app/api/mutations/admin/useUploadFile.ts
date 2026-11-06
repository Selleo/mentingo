import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { getTranslatedApiErrorMessage } from "~/api/utils/getTranslatedApiErrorMessage";
import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { ACHIEVEMENT_BADGE_FILE_RESOURCE } from "@repo/shared";

interface UploadFileOptions {
  file: File;
  resource?:
    | "lesson"
    | "lessonItem"
    | "file"
    | "course"
    | "learning-path"
    | "user"
    | "category"
    | "certificate"
    | typeof ACHIEVEMENT_BADGE_FILE_RESOURCE;
  lessonId?: string;
}

export function useUploadFile() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ file, resource, lessonId }: UploadFileOptions) => {
      const formData = new FormData();
      formData.append("file", file);
      resource && formData.append("resource", resource);
      lessonId && formData.append("lessonId", lessonId);

      const response = await ApiClient.api.fileControllerUploadFile(
        { file },
        {
          headers: { "Content-Type": "multipart/form-data" },
          transformRequest: () => {
            return formData;
          },
        },
      );

      return response.data;
    },
    onSuccess: (data) => {
      if (data?.status !== "processing") {
        toast({ description: t("uploadFile.toast.fileUploadedSuccessfully") });
      }
    },
    onError: (error) => {
      toast({
        description: getTranslatedApiErrorMessage(error, t, t("uploadFile.toast.uploadFailed"), {
          // Proxy rejections (e.g. 413) only carry Axios' English status text.
          allowUntranslatedMessage: false,
        }),
        variant: "destructive",
      });
    },
  });
}
