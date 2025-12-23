import { useMutation } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

interface UploadFileOptions {
  file: File;
  resource?: "lesson" | "lessonItem" | "file" | "course" | "user" | "category" | "certificate";
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
        description: error.message,
        variant: "destructive",
      });
    },
  });
}

export function useAssociateUploadWithLesson() {
  return useMutation({
    mutationFn: async ({ uploadId, lessonId }: { uploadId: string; lessonId: string }) => {
      const response = await ApiClient.api.fileControllerAssociateUploadWithLesson({
        uploadId,
        lessonId,
      });
      return response.data;
    },
  });
}
