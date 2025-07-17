import { useMutation } from "@tanstack/react-query";
import { AxiosError } from "axios";
import { useTranslation } from "react-i18next";

import { ApiClient } from "~/api/api-client";
import { useToast } from "~/components/ui/use-toast";

import type { BetaCreateAiMentorLessonBody } from "~/api/generated-api";

type CreateAiMentorLessonOptions = {
  data: BetaCreateAiMentorLessonBody;
};

export function useCreateAiMentorLesson() {
  const { toast } = useToast();
  const { t } = useTranslation();

  return useMutation({
    mutationFn: async (options: CreateAiMentorLessonOptions) => {
      const response = await ApiClient.api.lessonControllerBetaCreateAiMentorLesson(options.data);
      return response.data;
    },
    onSuccess: () => {
      toast({
        variant: "default",
        description: t("adminCourseView.curriculum.lesson.toast.aiMentorLessonCreatedSuccessfully"),
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
