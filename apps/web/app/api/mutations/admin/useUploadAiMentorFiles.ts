import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

import type { FileWithOptionalId } from "~/modules/Admin/EditCourse/CourseLessons/NewLesson/AiMentorLessonForm/components/MultiFileUploadForm";

type AiMentorFilesOptions = {
  files: FileWithOptionalId[];
  lessonId: string;
};

export function useUploadAiMentorFiles() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async ({ files, lessonId }: AiMentorFilesOptions) => {
      const formData = new FormData();
      files.forEach((f) => formData.append("files", f));

      formData.append("lessonId", lessonId);

      console.log(lessonId, files);

      const response = await ApiClient.api.ingestionControllerIngest(
        { files: files, lessonId },
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
          transformRequest: () => {
            return formData;
          },
        },
      );

      return response.data;
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
    onSuccess: () => {
      return toast({
        description: t(
          "adminCourseView.curriculum.lesson.toast.aiMentorLessonFileAddedSuccessfully",
        ),
        variant: "default",
      });
    },
  });
}
