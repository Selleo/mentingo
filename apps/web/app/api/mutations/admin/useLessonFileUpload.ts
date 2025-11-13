import { useMutation } from "@tanstack/react-query";
import { isAxiosError } from "axios";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

export type LessonFileUploadOptions = {
  lessonId: string;
  file: File;
};

export function useLessonFileUpload() {
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (options: LessonFileUploadOptions) => {
      const formData = new FormData();

      formData.append("file", options.file);
      formData.append("lessonId", options.lessonId);

      const response = await ApiClient.api.lessonControllerUploadImageToLesson(options, {
        headers: { "Content-Type": "multipart/form-data" },
        transformRequest: () => {
          return formData;
        },
      });
      return response.data;
    },
    onError: (error) => {
      if (isAxiosError(error)) {
        return toast({
          description: error.response?.data?.message,
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
