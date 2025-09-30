import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { useToast } from "~/components/ui/use-toast";

import { ApiClient } from "../../api-client";

import type { CreateEmbedLessonBody } from "~/api/generated-api";

type CreateLessonOptions = {
  data: CreateEmbedLessonBody;
};

export function useCreateEmbedLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateLessonOptions) => {
      const response = await ApiClient.api.lessonControllerCreateEmbedLesson(options.data);

      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("adminCourseView.curriculum.lesson.toast.lessonCreatedSuccessfully"),
      });
    },
    onError: (error) => {
      if (error instanceof AxiosError) {
        return toast({
          variant: "destructive",
          description: error.response?.data.message,
        });
      }
      toast({
        variant: "destructive",
        description: error.message,
      });
    },
  });
}
